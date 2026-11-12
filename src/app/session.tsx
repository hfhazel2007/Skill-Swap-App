import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import Navigation from './navbar';

const sessionTabs = [
  { key: 'Upcoming', label: 'Upcoming', icon: 'calendar-outline' as const, activeIcon: 'calendar' as const },
  { key: 'Past', label: 'Past', icon: 'time-outline' as const, activeIcon: 'time' as const },
  { key: 'Requests', label: 'Requests', icon: 'mail-outline' as const, activeIcon: 'mail' as const },
] as const;

type SessionTab = (typeof sessionTabs)[number]['key'];

interface SessionItem {
  id: number;
  session_id: number | null;
  status: string;
  meeting_link: string | null;
  scheduled_time: string;
  swap_requests: {
    id: number;
    requester_id: number;
    receiver_id: number;
    message: string;
    status: string;
    requester: { full_name: string } | null;
    receiver: { full_name: string } | null;
    skills: { name: string } | null;
  };
}

export default function SessionsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [activeTab, setActiveTab] = useState<SessionTab>('Upcoming');
  const [currentSessions, setCurrentSessions] = useState<SessionItem[]>([]);
  const [coinBalance, setCoinBalance] = useState<number>(0);

  const rawId = Array.isArray(userId) ? userId[0] : userId;
  const currentUserId = rawId && rawId !== 'undefined' ? parseInt(rawId, 10) : 1001;

  const fetchSessionsAndRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      if (isNaN(currentUserId)) {
        setError('Invalid user ID');
        return;
      }

      // 1. Fetch User Coin Balance
      const { data: userData } = await supabase
        .from('users')
        .select('coin_balance')
        .eq('id', currentUserId)
        .maybeSingle();

      if (userData) setCoinBalance(userData.coin_balance ?? 0);

      // 2. Fetch Swap Requests for target user
      const { data: swapRequestsData, error: swapError } = await supabase
        .from('swap_requests')
        .select('*')
        .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

      if (swapError) throw swapError;

      if (!swapRequestsData || swapRequestsData.length === 0) {
        setCurrentSessions([]);
        return;
      }

      // Collect IDs for separated lookups
      const userIds = Array.from(
        new Set(swapRequestsData.flatMap((r) => [r.requester_id, r.receiver_id]).filter(Boolean))
      );
      const skillIds = Array.from(
        new Set(swapRequestsData.map((r) => r.requested_skill_id).filter(Boolean))
      );
      const requestIds = swapRequestsData.map((r) => r.id);

      // 3. Parallel Lookups
      const [usersRes, skillsRes, sessionsRes] = await Promise.all([
        supabase.from('users').select('id, full_name').in('id', userIds),
        supabase.from('skills').select('id, name').in('id', skillIds),
        supabase.from('sessions').select('*').in('swap_request_id', requestIds),
      ]);

      const usersMap = new Map((usersRes.data || []).map((u) => [u.id, u.full_name]));
      const skillsMap = new Map((skillsRes.data || []).map((s) => [s.id, s.name]));
      const sessionsMap = new Map((sessionsRes.data || []).map((s) => [s.swap_request_id, s]));

      // 4. Merge data in memory
      const formattedItems: SessionItem[] = swapRequestsData.map((req) => {
        const sessionObj = sessionsMap.get(req.id);
        return {
          id: req.id,
          session_id: sessionObj?.id || null,
          status: sessionObj?.status || req.status,
          meeting_link: sessionObj?.meeting_link || null,
          scheduled_time: sessionObj?.scheduled_time || req.created_at,
          swap_requests: {
            id: req.id,
            requester_id: req.requester_id,
            receiver_id: req.receiver_id,
            message: req.message || '',
            status: req.status,
            requester: { full_name: usersMap.get(req.requester_id) || 'User' },
            receiver: { full_name: usersMap.get(req.receiver_id) || 'User' },
            skills: { name: skillsMap.get(req.requested_skill_id) || 'Skill Swap' },
          },
        };
      });

      setCurrentSessions(formattedItems);
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
      setError(err.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionsAndRequests();
  }, [userId]);

  const handleApproveRequest = async (requestId: number) => {
    try {
      setActionLoading(requestId);

      const { error: updateError } = await supabase
        .from('swap_requests')
        .update({ status: 'ACCEPTED' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      const { error: sessionError } = await supabase.from('sessions').insert({
        swap_request_id: requestId,
        status: 'SCHEDULED',
        scheduled_time: new Date(Date.now() + 86400000).toISOString(),
        meeting_link: 'https://meet.google.com/skill-swap-demo',
      });

      if (sessionError) throw sessionError;

      await fetchSessionsAndRequests();
    } catch (err: any) {
      console.error('Error approving request:', err);
      setError('Failed to approve swap request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineRequest = async (requestId: number, sessionId?: number | null) => {
    try {
      setActionLoading(requestId);

      const { error: updateError } = await supabase
        .from('swap_requests')
        .update({ status: 'DECLINED' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      if (sessionId) {
        await supabase.from('sessions').update({ status: 'CANCELLED' }).eq('id', sessionId);
      }

      await fetchSessionsAndRequests();
    } catch (err: any) {
      console.error('Error declining session:', err);
      setError('Failed to decline session.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredSessions = currentSessions.filter((item) => {
    const requestStatus = item.swap_requests?.status?.toUpperCase();
    const sessionStatus = item.status?.toUpperCase();

    if (activeTab === 'Requests') {
      return requestStatus === 'PENDING';
    }
    if (activeTab === 'Upcoming') {
      return (
        requestStatus === 'ACCEPTED' &&
        sessionStatus !== 'COMPLETED' &&
        sessionStatus !== 'CANCELLED'
      );
    }
    if (activeTab === 'Past') {
      return sessionStatus === 'COMPLETED';
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/headerIcon/skillSwap.png')}
          style={styles.logoIcon}
          resizeMode="contain"
        />
        <View style={styles.headerActions}>
          <View style={styles.coinView}>
            <Image
              source={require('../../assets/headerIcon/coin.png')}
              style={styles.coinIcon}
              resizeMode="contain"
            />
            <Text style={styles.coinCount}>{coinBalance}</Text>
          </View>
          <Image
            source={require('../../assets/headerIcon/notifications.png')}
            style={styles.headerIcon}
            resizeMode="contain"
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Banner Header */}
        <View style={styles.heroSection}>
          {/* Decorative background shapes */}
          <View style={styles.heroDecorCircle} />
          <Ionicons
            name="film-outline"
            size={84}
            color="rgba(240, 90, 40, 0.08)"
            style={styles.heroDecorWatermark}
          />

          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowIconBadge}>
              <Ionicons name="film" size={14} color="#FFFFFF" />
            </View>
            <Text style={styles.eyebrow}>YOUR WEEKLY LINEUP</Text>
          </View>

          <View style={styles.titleSparkRow}>
            <Text style={styles.pageTitle}>Sessions</Text>
            <Ionicons name="sparkles" size={20} color="#F05A28" style={styles.titleSparkIcon} />
          </View>

          <Text style={styles.subtitle}>Make time for the things you want to learn.</Text>
          <View style={styles.subtitleAccentBar} />
        </View>

        {/* Elevated Summary Card */}
        <View style={styles.weekSummaryCard}>
          <View style={styles.summaryBlock}>
            <View style={styles.summaryIconCircle}>
              <Ionicons name="calendar-outline" size={20} color="#245748" />
            </View>
            <View>
              <Text style={styles.summaryValue}>{filteredSessions.length}</Text>
              <Text style={styles.summaryLabel}>{activeTab.toLowerCase()} items</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryBlock}>
            <View style={styles.summaryIconCircle}>
              <Ionicons name="time-outline" size={20} color="#245748" />
            </View>
            <View>
              <Text style={styles.summaryValue}>{filteredSessions.length * 60}m</Text>
              <Text style={styles.summaryLabel}>time to trade</Text>
            </View>
          </View>
        </View>

        {/* Pill Tabs with Icons */}
        <View style={styles.tabsContainer}>
          {sessionTabs.map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabPill, isSelected && styles.tabPillSelected]}
              >
                <Ionicons
                  name={isSelected ? tab.activeIcon : tab.icon}
                  size={16}
                  color={isSelected ? '#FFFFFF' : '#29483F'}
                />
                <Text style={[styles.tabText, isSelected && styles.tabTextSelected]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Section Subheader */}
        <View style={styles.listHeader}>
          <View style={styles.listTitleRow}>
            <View style={styles.sectionIconTile}>
              <Ionicons name="film-outline" size={18} color="#152822" />
            </View>
            <View>
              <Text style={styles.listTitle}>
                {activeTab === 'Upcoming'
                  ? 'Coming up'
                  : activeTab === 'Past'
                  ? 'Wrapped up'
                  : 'Swap requests'}
              </Text>
              <Text style={styles.listCount}>
                {filteredSessions.length} {activeTab}
              </Text>
            </View>
          </View>

          {activeTab === 'Upcoming' && (
            <View style={styles.timezonePill}>
              <Text style={styles.timezone}>LOCAL TIME</Text>
              <Ionicons name="caret-down" size={10} color="#245748" />
            </View>
          )}
        </View>

        {/* Sessions List */}
        {loading ? (
          <ActivityIndicator size="large" color="#F05A28" style={{ marginTop: 30 }} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : filteredSessions.length > 0 ? (
          filteredSessions.map((session, index) => {
            const dateObj = new Date(session.scheduled_time);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const dateNum = dateObj.getDate();
            const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            const formattedTime = dateObj.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });

            const isRequester = session.swap_requests.requester_id === currentUserId;
            const isReceiver = session.swap_requests.receiver_id === currentUserId;
            const partnerId = isRequester
              ? session.swap_requests.receiver_id
              : session.swap_requests.requester_id;
            const partnerName = isRequester
              ? session.swap_requests.receiver?.full_name || 'Partner'
              : session.swap_requests.requester?.full_name || 'Partner';
            const mode = isRequester ? 'LEARNING' : 'TEACHING';
            const skillName = session.swap_requests.skills?.name || 'Skill Swap';
            const requestId = session.swap_requests.id;

            // Alternate subtle corner tint matching the reference cards
            const isEven = index % 2 === 0;

            return (
              <View key={session.id} style={styles.sessionCard}>
                {/* Subtle Corner Tint & Watermark */}
                <View
                  style={[
                    styles.cardCornerTint,
                    { backgroundColor: isEven ? 'rgba(247, 197, 136, 0.22)' : 'rgba(181, 214, 194, 0.28)' },
                  ]}
                />
                <Ionicons
                  name="film-outline"
                  size={44}
                  color="rgba(36, 87, 72, 0.08)"
                  style={styles.cardWatermarkIcon}
                />

                {/* Top Row: Ticket Stub + Details + Status Badge */}
                <View style={styles.cardMainRow}>
                  {/* Ticket-Style Date Badge */}
                  <View style={styles.ticketTile}>
                    <View style={styles.ticketHeader}>
                      <View style={styles.ticketPinDot} />
                      <Text style={styles.ticketDay}>{dayName}</Text>
                      <View style={styles.ticketPinDot} />
                    </View>
                    <View style={styles.ticketBody}>
                      <Text style={styles.ticketNumber}>{dateNum}</Text>
                      <Text style={styles.ticketMonth}>{monthName}</Text>
                    </View>
                    {/* Ticket Side Notches */}
                    <View style={[styles.ticketNotch, styles.ticketNotchLeft]} />
                    <View style={[styles.ticketNotch, styles.ticketNotchRight]} />
                  </View>

                  <View style={styles.ticketDivider} />

                  {/* Session Details */}
                  <View style={styles.sessionInfo}>
                    <View style={styles.topicHeaderRow}>
                      <Text style={styles.topic} numberOfLines={2}>
                        {skillName}
                      </Text>

                      <View style={styles.statusBadge}>
                        <Ionicons name="calendar-outline" size={11} color="#245748" />
                        <Text style={styles.statusBadgeText}>
                          {activeTab === 'Requests' ? session.swap_requests.status : session.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      <Ionicons name="person-circle-outline" size={15} color="#526159" />
                      <Text style={styles.partner}>
                        {activeTab === 'Requests'
                          ? isReceiver
                            ? `Request from ${partnerName}`
                            : `Request sent to ${partnerName}`
                          : `with ${partnerName}`}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <Ionicons
                        name={activeTab === 'Requests' ? 'chatbox-ellipses-outline' : 'time-outline'}
                        size={14}
                        color="#245748"
                      />
                      <Text style={styles.schedule} numberOfLines={2}>
                        {activeTab === 'Requests'
                          ? session.swap_requests.message || 'No message provided'
                          : `${formattedTime} · 60 mins`}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Bottom Row: Mode Tag & Action Buttons */}
                <View style={styles.cardFooter}>
                  <View style={[styles.modePill, mode === 'TEACHING' && styles.teachingPill]}>
                    <Ionicons
                      name={mode === 'LEARNING' ? 'school' : 'briefcase'}
                      size={12}
                      color={mode === 'LEARNING' ? '#245748' : '#8A5B1D'}
                    />
                    <Text style={[styles.modeText, mode === 'TEACHING' && styles.teachingText]}>
                      {mode}
                    </Text>
                  </View>

                  <View style={styles.actions}>
                    {activeTab === 'Requests' ? (
                      isReceiver ? (
                        <>
                          <TouchableOpacity
                            style={styles.primaryPillButton}
                            disabled={actionLoading === requestId}
                            onPress={() => handleApproveRequest(requestId)}
                          >
                            {actionLoading === requestId ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                                <Text style={styles.primaryPillText}>Approve</Text>
                              </>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.secondaryPillButton}
                            disabled={actionLoading === requestId}
                            onPress={() => handleDeclineRequest(requestId, session.session_id)}
                          >
                            <Ionicons name="close" size={14} color="#203A33" />
                            <Text style={styles.secondaryPillText}>Decline</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <View style={styles.pendingPill}>
                          <Ionicons name="hourglass-outline" size={13} color="#8D99AE" />
                          <Text style={styles.pendingPillText}>Pending Approval</Text>
                        </View>
                      )
                    ) : (
                      <>
                        {session.meeting_link && activeTab === 'Upcoming' ? (
                          <TouchableOpacity
                            style={styles.primaryPillButton}
                            onPress={() => Linking.openURL(session.meeting_link!)}
                          >
                            <Ionicons name="call" size={13} color="#FFFFFF" />
                            <Text style={styles.primaryPillText}>Join Call</Text>
                          </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity
                          style={styles.secondaryPillButton}
                          onPress={() =>
                            router.push({
                              pathname: '/messages',
                              params: {
                                userId: String(currentUserId),
                                conversation: partnerName,
                                targetUserId: String(partnerId),
                              },
                            })
                          }
                        >
                          <Ionicons name="chatbubble-ellipses-outline" size={14} color="#203A33" />
                          <Text style={styles.secondaryPillText}>Message</Text>
                        </TouchableOpacity>

                        {activeTab === 'Upcoming' && (
                          <TouchableOpacity
                            style={styles.secondaryPillButton}
                            disabled={actionLoading === requestId}
                            onPress={() => handleDeclineRequest(requestId, session.session_id)}
                          >
                            {actionLoading === requestId ? (
                              <ActivityIndicator size="small" color="#203A33" />
                            ) : (
                              <>
                                <Ionicons name="close" size={14} color="#203A33" />
                                <Text style={styles.secondaryPillText}>Decline</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={36} color="#9BA8A0" />
            <Text style={styles.emptyTitle}>No {activeTab.toLowerCase()} items</Text>
            <Text style={styles.emptySubtitle}>
              Your scheduled sessions and swap requests will appear here.
            </Text>
          </View>
        )}
      </ScrollView>

      <Navigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6EC' },
  header: {
    minHeight: 90,
    paddingTop: 24,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFCF6',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE6D8',
  },
  logoIcon: { width: 116, height: 58 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerIcon: { width: 34, height: 34 },
  coinView: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2AC3C',
    borderRadius: 18,
    paddingHorizontal: 8,
  },
  coinIcon: { width: 20, height: 28 },
  coinCount: { color: '#30291F', fontSize: 13, fontWeight: '700' },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 124 },

  /* Hero Section */
  heroSection: {
    backgroundColor: '#F9ECDC',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0DEC6',
  },
  heroDecorCircle: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(240, 90, 40, 0.12)',
  },
  heroDecorWatermark: {
    position: 'absolute',
    right: 12,
    bottom: -10,
    transform: [{ rotate: '-15deg' }],
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  eyebrowIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F05A28',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#D94B1E',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  titleSparkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageTitle: {
    color: '#152822',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  titleSparkIcon: {
    marginLeft: 6,
    marginTop: -8,
  },
  subtitle: {
    color: '#4F5D56',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  subtitleAccentBar: {
    width: 68,
    height: 3,
    backgroundColor: '#F29F38',
    borderRadius: 2,
    marginTop: 8,
  },

  /* Elevated Summary Card */
  weekSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFCF8',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EDE2D2',
    shadowColor: '#203A33',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  summaryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5F0E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    color: '#152822',
    fontSize: 20,
    fontWeight: '900',
  },
  summaryLabel: {
    color: '#66766B',
    fontSize: 11,
    fontWeight: '600',
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#F0A47A',
    opacity: 0.5,
  },

  /* Pill Tabs */
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF4EA',
    borderRadius: 24,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EADCCE',
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 20,
  },
  tabPillSelected: {
    backgroundColor: '#F05A28',
    shadowColor: '#F05A28',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  tabText: {
    color: '#29483F',
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  /* Section Header */
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFE5D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTitle: {
    color: '#152822',
    fontSize: 18,
    fontWeight: '900',
  },
  listCount: {
    color: '#6C7A72',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  timezonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DDEBD9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  timezone: {
    color: '#245748',
    fontSize: 10,
    fontWeight: '800',
  },

  /* Session Card */
  sessionCard: {
    backgroundColor: '#FFFCF8',
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardCornerTint: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  cardWatermarkIcon: {
    position: 'absolute',
    right: 12,
    bottom: 44,
    transform: [{ rotate: '-12deg' }],
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  /* Ticket-Stub Date Badge */
  ticketTile: {
    width: 58,
    borderRadius: 10,
    backgroundColor: '#F9F3EA',
    borderWidth: 1,
    borderColor: '#E5D8C7',
    overflow: 'hidden',
  },
  ticketHeader: {
    backgroundColor: '#E84828',
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  ticketPinDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  ticketDay: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ticketBody: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
  },
  ticketNumber: {
    color: '#152822',
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 24,
  },
  ticketMonth: {
    color: '#29483F',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 1,
  },
  ticketNotch: {
    position: 'absolute',
    bottom: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFCF8',
    borderWidth: 1,
    borderColor: '#E5D8C7',
  },
  ticketNotchLeft: { left: -5 },
  ticketNotchRight: { right: -5 },
  ticketDivider: {
    width: 1,
    height: 62,
    backgroundColor: '#E8C4B0',
    marginHorizontal: 12,
  },

  /* Session Info */
  sessionInfo: {
    flex: 1,
    minWidth: 0,
  },
  topicHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  topic: {
    flex: 1,
    color: '#152822',
    fontSize: 17,
    fontWeight: '900',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCECD9',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    color: '#245748',
    fontSize: 9,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  partner: {
    color: '#4F5D56',
    fontSize: 13,
    fontWeight: '500',
  },
  schedule: {
    flex: 1,
    color: '#152822',
    fontSize: 12,
    fontWeight: '700',
  },

  /* Footer & Action Pills */
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3EAE0',
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCECD9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modeText: {
    color: '#245748',
    fontSize: 10,
    fontWeight: '800',
  },
  teachingPill: {
    backgroundColor: '#FDE8C8',
  },
  teachingText: {
    color: '#8A5B1D',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  primaryPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F05A28',
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 7,
    shadowColor: '#F05A28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  secondaryPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FDF8F1',
    borderWidth: 1,
    borderColor: '#E3D5C3',
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  secondaryPillText: {
    color: '#152822',
    fontSize: 11,
    fontWeight: '700',
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFECE6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pendingPillText: {
    color: '#7E8A84',
    fontSize: 11,
    fontWeight: '700',
  },
  errorText: {
    color: '#B4233A',
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '600',
  },
  emptyState: {
    padding: 36,
    alignItems: 'center',
    backgroundColor: '#FFFCF8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EADCCE',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#152822',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#7C8178',
    textAlign: 'center',
    marginTop: 4,
  },
});