import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import Navigation from './navbar';

interface JoinedSkill {
  skills:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
}

interface UserProfile {
  id: number;
  full_name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  coin_balance: number;
  trust_rating: number;
  created_at: string;
  offered_skills: JoinedSkill[];
  skill_requests: JoinedSkill[];
}

function getInitials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatMemberSince(date?: string) {
  if (!date) return '—';
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return '—';
  return parsedDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function getSkillName(skill: JoinedSkill) {
  if (!skill.skills) return undefined;
  return Array.isArray(skill.skills) ? skill.skills[0]?.name : skill.skills.name;
}

// Rotating warm badge palettes matching the reference skill pills
const teachingChipThemes = [
  { bg: '#DCECD9', border: '#B9D6B4', text: '#1E463A', icon: '#245748' },
  { bg: '#FDE8C8', border: '#F5CD93', text: '#7A4D14', icon: '#8A5B1D' },
  { bg: '#FADBD4', border: '#F0B6A8', text: '#8C321E', icon: '#B84E38' },
  { bg: '#E3E6F8', border: '#C2C8EE', text: '#2D376E', icon: '#3F4E9C' },
];

const learningChipThemes = [
  { bg: '#F9DEC9', border: '#EFC09E', text: '#7C3E18', icon: '#B84E38' },
  { bg: '#E5E4F7', border: '#C8C5EB', text: '#38336B', icon: '#4E4794' },
  { bg: '#DCECD9', border: '#B9D6B4', text: '#1E463A', icon: '#245748' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offeredSkills, setOfferedSkills] = useState<string[]>([]);
  const [wantedSkills, setWantedSkills] = useState<string[]>([]);

  useEffect(() => {
    async function fetchUserProfile() {
      try {
        setLoading(true);
        setError(null);

        const rawId = Array.isArray(userId) ? userId[0] : userId;
        const targetId = rawId && rawId !== 'undefined' ? parseInt(rawId, 10) : 1001;

        if (Number.isNaN(targetId)) {
          setError('Invalid user ID');
          return;
        }

        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select(`
            id, full_name, email, avatar_url, bio, coin_balance, trust_rating, created_at,
            offered_skills (
              skills ( name )
            ),
            skill_requests (
              skills ( name )
            )
          `)
          .eq('id', targetId)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!userData) {
          setError('User profile not found.');
          return;
        }

        const rawUserData = userData as UserProfile;
        setProfile(rawUserData);
        setOfferedSkills(
          (rawUserData.offered_skills?.map(getSkillName).filter(Boolean) as string[]) || []
        );
        setWantedSkills(
          (rawUserData.skill_requests?.map(getSkillName).filter(Boolean) as string[]) || []
        );
      } catch (fetchError) {
        console.error('Error fetching profile:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchUserProfile();
  }, [userId]);

  const displayName = profile?.full_name || 'Your profile';
  const rating = profile?.trust_rating ? profile.trust_rating.toFixed(1) : '—';

  const logOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error('Error signing out:', signOutError);
    }
    router.replace('/');
  };

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
            <Text style={styles.coinCount}>{profile?.coin_balance ?? 126}</Text>
          </View>
          <Image
            source={require('../../assets/headerIcon/notifications.png')}
            style={styles.headerIcon}
            resizeMode="contain"
          />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial Hero Header matching Sessions Screen */}
        <View style={styles.heroHeader}>
          <Ionicons
            name="sparkles"
            size={64}
            color="rgba(240, 90, 40, 0.08)"
            style={styles.headerWatermark}
          />
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowIconBadge}>
              <Ionicons name="person" size={13} color="#FFFFFF" />
            </View>
            <Text style={styles.eyebrow}>MY PROFILE</Text>
          </View>

          <View style={styles.titleSparkRow}>
            <Text style={styles.pageTitle}>Your learning journey</Text>
            <Ionicons name="sparkles" size={18} color="#F05A28" style={styles.titleSparkIcon} />
          </View>
          <View style={styles.titleAccentBar} />
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color="#F05A28" />
            <Text style={styles.stateText}>Loading your profile...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={32} color="#B84E38" />
            <Text style={styles.stateTitle}>We couldn’t load this profile</Text>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Ticket-Stub Identity Card */}
            <View style={styles.ticketHeroCard}>
              {/* Decorative Background Film & Sparkle Icons */}
              <Ionicons
                name="film-outline"
                size={88}
                color="rgba(255, 248, 234, 0.07)"
                style={styles.ticketWatermarkReel}
              />
              <Ionicons
                name="sparkles"
                size={22}
                color="rgba(246, 214, 140, 0.35)"
                style={styles.ticketSparkleTop}
              />

              {/* Perforated Ticket Edge Notches */}
              <View style={[styles.ticketEdgeNotch, styles.notchTopLeft]} />
              <View style={[styles.ticketEdgeNotch, styles.notchMidLeft]} />
              <View style={[styles.ticketEdgeNotch, styles.notchBotLeft]} />
              <View style={[styles.ticketEdgeNotch, styles.notchTopRight]} />
              <View style={[styles.ticketEdgeNotch, styles.notchMidRight]} />
              <View style={[styles.ticketEdgeNotch, styles.notchBotRight]} />

              <View style={styles.identity}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(profile?.full_name)}</Text>
                  </View>
                )}

                <View style={styles.identityCopy}>
                  <View style={styles.statusPill}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>Available to swap</Text>
                  </View>
                  <Text style={styles.name} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <View style={styles.emailRow}>
                    <Ionicons name="mail-outline" size={13} color="#C4D8CB" />
                    <Text style={styles.headline} numberOfLines={1}>
                      {profile?.email || 'Add an email to your profile'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Dashed Ticket Tear Divider */}
              <View style={styles.dashedDivider} />

              <View style={styles.heroFooter}>
                <View style={styles.memberLabelRow}>
                  <Ionicons name="ticket-outline" size={14} color="#A8C6B5" />
                  <Text style={styles.heroFooterLabel}>MEMBER SINCE</Text>
                </View>
                <Text style={styles.heroFooterValue}>{formatMemberSince(profile?.created_at)}</Text>
              </View>
            </View>

            {/* Icon-Driven Stats Card */}
            <View style={styles.statsCard}>
              <View style={styles.stat}>
                <View style={styles.statTopRow}>
                  <View style={[styles.statIconBadge, { backgroundColor: '#E5F0E6' }]}>
                    <Ionicons name="calendar-outline" size={16} color="#245748" />
                  </View>
                  <Text style={styles.statValue}>18</Text>
                </View>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.stat}>
                <View style={styles.statTopRow}>
                  <View style={[styles.statIconBadge, { backgroundColor: '#FDE8C8' }]}>
                    <Ionicons name="star" size={15} color="#D9822B" />
                  </View>
                  <Text style={styles.statValue}>{rating}</Text>
                </View>
                <Text style={styles.statLabel}>Trust rating</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.stat}>
                <View style={styles.statTopRow}>
                  <View style={[styles.statIconBadge, { backgroundColor: '#FADBD4' }]}>
                    <Ionicons name="people-outline" size={16} color="#B84E38" />
                  </View>
                  <Text style={styles.statValue}>12</Text>
                </View>
                <Text style={styles.statLabel}>Connections</Text>
              </View>
            </View>

            {/* About Me Section Card */}
            <View style={styles.sectionCard}>
              <Ionicons
                name="film-outline"
                size={46}
                color="rgba(36, 87, 72, 0.06)"
                style={styles.cardCornerWatermark}
              />
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconTile}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#245748" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionKicker}>A LITTLE ABOUT ME</Text>
                  <Text style={styles.sectionTitle}>Bio & Interests</Text>
                </View>
                <Ionicons name="sparkles-outline" size={16} color="#F05A28" />
              </View>
              <Text style={styles.aboutText}>
                {profile?.bio || 'Tell the community a little about yourself and what you love to build or learn.'}
              </Text>
            </View>

            {/* Teaching Skills Section Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionIconTile, { backgroundColor: '#DCECD9' }]}>
                  <Ionicons name="briefcase-outline" size={16} color="#245748" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionKicker}>I CAN TEACH</Text>
                  <Text style={styles.sectionTitle}>Skills I offer</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{offeredSkills.length}</Text>
                </View>
              </View>

              <View style={styles.skillList}>
                {offeredSkills.length > 0 ? (
                  offeredSkills.map((skill, index) => {
                    const theme = teachingChipThemes[index % teachingChipThemes.length];
                    return (
                      <View
                        key={`offered-${skill}-${index}`}
                        style={[
                          styles.skillChip,
                          { backgroundColor: theme.bg, borderColor: theme.border },
                        ]}
                      >
                        <Text style={[styles.skillChipText, { color: theme.text }]}>{skill}</Text>
                        <Ionicons name="ribbon-outline" size={14} color={theme.icon} />
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No skills listed yet.</Text>
                )}
              </View>
            </View>

            {/* Learning Skills Section Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionIconTile, { backgroundColor: '#FDE8C8' }]}>
                  <Ionicons name="school-outline" size={17} color="#8A5B1D" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionKicker}>I WANT TO LEARN</Text>
                  <Text style={styles.sectionTitle}>Skills I’m seeking</Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: '#FDE8C8' }]}>
                  <Text style={[styles.countBadgeText, { color: '#8A5B1D' }]}>
                    {wantedSkills.length}
                  </Text>
                </View>
              </View>

              <View style={styles.skillList}>
                {wantedSkills.length > 0 ? (
                  wantedSkills.map((skill, index) => {
                    const theme = learningChipThemes[index % learningChipThemes.length];
                    return (
                      <View
                        key={`wanted-${skill}-${index}`}
                        style={[
                          styles.skillChip,
                          { backgroundColor: theme.bg, borderColor: theme.border },
                        ]}
                      >
                        <Text style={[styles.skillChipText, { color: theme.text }]}>{skill}</Text>
                        <Ionicons name="sparkles-outline" size={13} color={theme.icon} />
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No learning goals listed yet.</Text>
                )}
              </View>
            </View>

            {/* Outlined Pill Log Out Button */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Log out"
              onPress={logOut}
              style={styles.logoutButton}
            >
              <Ionicons name="log-out-outline" size={18} color="#152822" />
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </>
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
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 124 },

  /* Hero Header matching Sessions */
  heroHeader: {
    marginBottom: 16,
    position: 'relative',
  },
  headerWatermark: {
    position: 'absolute',
    right: 6,
    top: -4,
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
    letterSpacing: 1.2,
  },
  titleSparkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageTitle: {
    color: '#152822',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  titleSparkIcon: {
    marginLeft: 6,
    marginTop: -6,
  },
  titleAccentBar: {
    width: 64,
    height: 3,
    backgroundColor: '#F29F38',
    borderRadius: 2,
    marginTop: 7,
  },

  /* Cinema Ticket-Stub Identity Card */
  ticketHeroCard: {
    overflow: 'hidden',
    backgroundColor: '#214E41',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#193E33',
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  ticketWatermarkReel: {
    position: 'absolute',
    right: 10,
    top: 8,
    transform: [{ rotate: '15deg' }],
  },
  ticketSparkleTop: {
    position: 'absolute',
    right: 26,
    bottom: 54,
  },
  ticketEdgeNotch: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FDF6EC',
  },
  notchTopLeft: { left: -7, top: 26 },
  notchMidLeft: { left: -7, top: '50%', marginTop: -7 },
  notchBotLeft: { left: -7, bottom: 26 },
  notchTopRight: { right: -7, top: 26 },
  notchMidRight: { right: -7, top: '50%', marginTop: -7 },
  notchBotRight: { right: -7, bottom: 26 },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#F9F3E6',
    borderWidth: 3,
    borderColor: '#F2AC3C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#152822',
    fontSize: 25,
    fontWeight: '900',
  },
  identityCopy: {
    flex: 1,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCE8DB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F2AC3C',
    marginRight: 6,
  },
  statusText: {
    color: '#1A4236',
    fontSize: 11,
    fontWeight: '800',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  headline: {
    color: '#C8DDD0',
    fontSize: 12,
    fontWeight: '500',
  },
  dashedDivider: {
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(196, 216, 203, 0.35)',
    borderStyle: 'dashed',
    marginTop: 18,
    marginBottom: 14,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroFooterLabel: {
    color: '#B6D1C2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroFooterValue: {
    color: '#FFF8EA',
    fontSize: 13,
    fontWeight: '800',
  },

  /* Icon-Driven Stats Card */
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFCF8',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EADCCE',
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: '#152822',
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    color: '#66766B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#E8DFD1',
  },

  /* Section Cards */
  sectionCard: {
    backgroundColor: '#FFFCF8',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EADCCE',
    overflow: 'hidden',
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardCornerWatermark: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    transform: [{ rotate: '-15deg' }],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFE5D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionKicker: {
    color: '#D94B1E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  sectionTitle: {
    color: '#152822',
    fontSize: 17,
    fontWeight: '900',
  },
  aboutText: {
    color: '#4F5D56',
    fontSize: 14,
    lineHeight: 21,
  },
  countBadge: {
    backgroundColor: '#DCECD9',
    borderRadius: 12,
    minWidth: 28,
    paddingVertical: 4,
    paddingHorizontal: 9,
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#245748',
    fontSize: 12,
    fontWeight: '800',
  },
  skillList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  skillChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyText: {
    color: '#8A918B',
    fontSize: 13,
  },

  /* Outlined Pill Log Out Button */
  logoutButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#D6C7B4',
    borderRadius: 25,
    backgroundColor: '#FFFCF8',
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  logoutText: {
    color: '#152822',
    fontSize: 15,
    fontWeight: '800',
  },
  stateCard: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFCF8',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#EADCCE',
  },
  stateTitle: {
    color: '#152822',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  stateText: {
    color: '#7C8178',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});