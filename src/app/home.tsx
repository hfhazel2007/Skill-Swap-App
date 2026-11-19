import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import Navigation from './navbar';

interface UserProfile {
  id: number;
  full_name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  coin_balance: number;
  trust_rating: number;
  created_at: string;
  skill_requests: {
    skills:
      | {
          name: string;
        }
      | {
          name: string;
        }[]
      | null;
  }[];
}

interface UpcomingSession {
  id: number;
  status: string;
  scheduled_time: string;
  meeting_link: string | null;
  skill_name: string;
  partner_name: string;
  mode: 'LEARN' | 'TEACH';
}

interface RecommendedClass {
  id: number;
  title: string;
  category: string;
  teacher: string;
  coins: number;
  mark: string;
  tint: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

const TINT_PALETTE = ['#DCECD9', '#FDE8C8', '#FADBD4', '#E3E6F8', '#DFF0F5'];

function getSkillName(skillRequest: UserProfile['skill_requests'][number]) {
  if (!skillRequest.skills) return undefined;
  return Array.isArray(skillRequest.skills) ? skillRequest.skills[0]?.name : skillRequest.skills.name;
}

function getCategoryIcon(categoryOrTitle: string): keyof typeof Ionicons.glyphMap {
  const q = categoryOrTitle.toLowerCase();
  if (q.includes('code') || q.includes('program') || q.includes('react') || q.includes('java') || q.includes('sql')) {
    return 'code-slash-outline';
  }
  if (q.includes('design') || q.includes('ui') || q.includes('art') || q.includes('photo')) {
    return 'color-palette-outline';
  }
  if (q.includes('music') || q.includes('guitar') || q.includes('piano')) {
    return 'musical-notes-outline';
  }
  if (q.includes('spanish') || q.includes('french') || q.includes('language') || q.includes('english')) {
    return 'language-outline';
  }
  if (q.includes('yoga') || q.includes('fitness') || q.includes('lifestyle')) {
    return 'leaf-outline';
  }
  return 'school-outline';
}

export default function HomeScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<UpcomingSession[]>([]);
  const [recommendedClasses, setRecommendedClasses] = useState<RecommendedClass[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Modal & Form State for "Offer a Skill"
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [skillName, setSkillName] = useState('');
  const [category, setCategory] = useState('Programming');
  const [skillType, setSkillType] = useState<'Academic' | 'Lifestyle'>('Academic');
  const [proficiencyLevel, setProficiencyLevel] = useState('Intermediate');
  const [coinRequest, setCoinRequest] = useState('25');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const rawId = Array.isArray(userId) ? userId[0] : userId;
  const targetId = rawId && rawId !== 'undefined' ? parseInt(rawId, 10) : 1001;

  const fetchHomeData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (Number.isNaN(targetId)) {
        setError('Invalid user ID');
        return;
      }

      // 1. Fetch User Profile
      const { data: userData, error: profileError } = await supabase
        .from('users')
        .select(`
          id, full_name, email, avatar_url, bio, coin_balance, trust_rating, created_at,
          skill_requests (
            skills ( name )
          )
        `)
        .eq('id', targetId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!userData) {
        setError('User profile not found.');
        return;
      }

      const rawUserProfile = userData as UserProfile;
      setProfile(rawUserProfile);

      const userRequestedSkillNames = (rawUserProfile.skill_requests || [])
        .map(getSkillName)
        .filter(Boolean)
        .map((name) => name!.toLowerCase());

      // 2. Fetch Upcoming Sessions
      const { data: swapData, error: swapError } = await supabase
        .from('swap_requests')
        .select(`
          id,
          requester_id,
          receiver_id,
          status,
          requester:users!swap_requests_requester_id_fkey ( full_name ),
          receiver:users!swap_requests_receiver_id_fkey ( full_name ),
          skills:skills!swap_requests_requested_skill_id_fkey ( name ),
          sessions!inner (
            id,
            status,
            scheduled_time,
            meeting_link
          )
        `)
        .or(`requester_id.eq.${targetId},receiver_id.eq.${targetId}`)
        .eq('status', 'ACCEPTED');

      if (!swapError && swapData) {
        const sessionsList: UpcomingSession[] = swapData.flatMap((request: any) => {
          const rawSessions = Array.isArray(request.sessions) ? request.sessions : [request.sessions];
          return rawSessions
            .filter(
              (sess: any) =>
                sess.status?.toUpperCase() !== 'COMPLETED' &&
                sess.status?.toUpperCase() !== 'CANCELLED'
            )
            .map((sess: any) => {
              const isRequester = request.requester_id === targetId;
              return {
                id: sess.id,
                status: sess.status,
                scheduled_time: sess.scheduled_time,
                meeting_link: sess.meeting_link,
                skill_name: request.skills?.name || 'Skill Swap',
                partner_name: isRequester
                  ? request.receiver?.full_name || 'Partner'
                  : request.requester?.full_name || 'Partner',
                mode: isRequester ? 'LEARN' : 'TEACH',
              };
            });
        });
        setUpcomingSessions(sessionsList);
      }

      // 3. Fetch Offered Skills for Recommended Section
      const { data: offeredData, error: offeredError } = await supabase
        .from('offered_skills')
        .select(`
          id,
          user_id,
          coin_request,
          skills!inner (
            id,
            name,
            category,
            skill_type
          ),
          users!inner (
            id,
            full_name
          )
        `)
        .eq('type', 'OFFERED')
        .neq('user_id', targetId);

      if (!offeredError && offeredData) {
        const formattedClasses: RecommendedClass[] = offeredData.map((row: any, index: number) => {
          const title = row.skills?.name || 'Skill';
          const rawCat = row.skills?.skill_type || row.skills?.category || 'Academic';
          return {
            id: row.id,
            title,
            category: rawCat.toUpperCase(),
            teacher: row.users?.full_name || 'Community Peer',
            coins: row.coin_request ?? 25,
            mark: title.substring(0, 4).toUpperCase(),
            tint: TINT_PALETTE[index % TINT_PALETTE.length],
            iconName: getCategoryIcon(`${rawCat} ${title}`),
          };
        });

        formattedClasses.sort((a, b) => {
          const aMatch = userRequestedSkillNames.includes(a.title.toLowerCase()) ? -1 : 1;
          const bMatch = userRequestedSkillNames.includes(b.title.toLowerCase()) ? -1 : 1;
          return aMatch - bMatch;
        });

        setRecommendedClasses(formattedClasses);
      }
    } catch (fetchErr) {
      console.error('Error fetching home data:', fetchErr);
      setError(fetchErr instanceof Error ? fetchErr.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeData();
  }, [userId]);

  const handleOfferSkillSubmit = async () => {
    setFormError('');
    const trimmedSkillName = skillName.trim();
    const parsedCoins = parseInt(coinRequest, 10);

    if (!trimmedSkillName) {
      setFormError('Please enter a skill name.');
      return;
    }
    if (isNaN(parsedCoins) || parsedCoins < 0) {
      setFormError('Please enter a valid coin amount.');
      return;
    }

    setSubmitting(true);
    try {
      let targetSkillId: number;

      const { data: existingSkill, error: checkError } = await supabase
        .from('skills')
        .select('id')
        .ilike('name', trimmedSkillName)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingSkill) {
        targetSkillId = existingSkill.id;
      } else {
        const { data: newSkill, error: createError } = await supabase
          .from('skills')
          .insert({
            name: trimmedSkillName,
            category: category.trim() || 'General',
            skill_type: skillType,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        targetSkillId = newSkill.id;
      }

      const { error: offerError } = await supabase.from('offered_skills').insert({
        user_id: targetId,
        skill_id: targetSkillId,
        type: 'OFFERED',
        proficiency_level: proficiencyLevel,
        coin_request: parsedCoins,
      });

      if (offerError) throw offerError;

      setSkillName('');
      setCategory('Programming');
      setCoinRequest('25');
      setModalVisible(false);
      await fetchHomeData();
    } catch (err: any) {
      console.error('Error adding offered skill:', err);
      setFormError(err.message || 'Failed to add skill offer.');
    } finally {
      setSubmitting(false);
    }
  };

  const todayFormatted = new Date()
    .toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    .toUpperCase();

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
            <Text style={styles.coinCount}>{profile?.coin_balance ?? 0}</Text>
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
        {/* Editorial Hero Header */}
        <View style={styles.heroBanner}>
          <View style={styles.heroDecorCircle} />
          <Ionicons
            name="film-outline"
            size={84}
            color="rgba(240, 90, 40, 0.08)"
            style={styles.heroWatermark}
          />

          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowIconBadge}>
              <Ionicons name="sunny" size={13} color="#FFFFFF" />
            </View>
            <Text style={styles.eyebrow}>{todayFormatted}</Text>
          </View>

          <View style={styles.titleSparkRow}>
            <Text style={styles.welcome}>
              Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'}
            </Text>
            <Ionicons name="sparkles" size={19} color="#F05A28" style={styles.titleSparkIcon} />
          </View>

          <Text style={styles.subtitle}>What would you like to learn or share today?</Text>
          <View style={styles.subtitleAccentBar} />
        </View>

        {/* Ticket-Stub Quick Action Cards */}
        <View style={styles.quickActions}>
          {/* LEARN Card */}
         <TouchableOpacity
            style={[styles.quickActionCard, styles.learnActionCard]}
            onPress={() =>
              router.push({
                pathname: '/explore',
                params: {
                  userId: String(targetId),
                  fromFindTeacher: 'true',
                  recommendedSkills: (profile?.skill_requests || [])
                    .map(getSkillName)
                    .filter(Boolean)
                    .join(','),
                },
              })
            }
            accessibilityRole="button"
          >
            <Ionicons
              name="compass-outline"
              size={58}
              color="rgba(184, 78, 56, 0.09)"
              style={styles.actionWatermark}
            />
            <View style={[styles.ticketNotchSmall, styles.notchLeftSmall]} />
            <View style={[styles.ticketNotchSmall, styles.notchRightSmall]} />

            <View style={styles.actionTopRow}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#FADBD4' }]}>
                <Ionicons name="compass" size={19} color="#B84E38" />
              </View>
              <View style={[styles.actionTagPill, { backgroundColor: '#FADBD4' }]}>
                <Text style={styles.actionLabel}>LEARN</Text>
              </View>
            </View>

            <Text style={styles.actionTitle}>Find a teacher</Text>
            <Text style={styles.actionDescription}>Browse skills to learn</Text>

            <View style={styles.actionCtaRow}>
              <Text style={[styles.actionCtaText, { color: '#B84E38' }]}>Explore</Text>
              <Ionicons name="arrow-forward-circle" size={15} color="#B84E38" />
            </View>
          </TouchableOpacity>

          {/* TEACH Card */}
          <TouchableOpacity
            style={[styles.quickActionCard, styles.teachActionCard]}
            onPress={() => setModalVisible(true)}
            accessibilityRole="button"
          >
            <Ionicons
              name="bulb-outline"
              size={58}
              color="rgba(36, 87, 72, 0.09)"
              style={styles.actionWatermark}
            />
            <View style={[styles.ticketNotchSmall, styles.notchLeftSmall]} />
            <View style={[styles.ticketNotchSmall, styles.notchRightSmall]} />

            <View style={styles.actionTopRow}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#DCECD9' }]}>
                <Ionicons name="bulb" size={19} color="#245748" />
              </View>
              <View style={[styles.actionTagPill, { backgroundColor: '#DCECD9' }]}>
                <Text style={[styles.actionLabel, styles.teachLabel]}>TEACH</Text>
              </View>
            </View>

            <Text style={styles.actionTitle}>Offer a skill</Text>
            <Text style={styles.actionDescription}>Share what you know</Text>

            <View style={styles.actionCtaRow}>
              <Text style={[styles.actionCtaText, { color: '#245748' }]}>Create offer</Text>
              <Ionicons name="add-circle" size={15} color="#245748" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Upcoming Sessions Section Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIconTile}>
              <Ionicons name="calendar-outline" size={17} color="#152822" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Upcoming sessions</Text>
              <Text style={styles.sectionSubtitle}>Your next learning moments</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.seeAllPill}
            onPress={() =>
              router.push({
                pathname: '/session',
                params: { userId: String(targetId) },
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>See all</Text>
            <Ionicons name="chevron-forward" size={12} color="#F05A28" />
          </TouchableOpacity>
        </View>

        {/* Upcoming Sessions Ticket Cards */}
        <View style={styles.sessionListContainer}>
          {loading ? (
            <ActivityIndicator size="small" color="#F05A28" style={{ paddingVertical: 24 }} />
          ) : upcomingSessions.length > 0 ? (
            upcomingSessions.map((session) => {
              const dateObj = new Date(session.scheduled_time);
              const monthStr = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
              const dateNumStr = String(dateObj.getDate()).padStart(2, '0');
              const dayStr = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
              const timeStr = dateObj.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              });

              const isTeach = session.mode === 'TEACH';

              return (
                <TouchableOpacity
                  key={session.id}
                  style={styles.sessionTicketCard}
                  onPress={() =>
                    router.push({
                      pathname: '/session',
                      params: { userId: String(targetId) },
                    })
                  }
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="film-outline"
                    size={40}
                    color="rgba(36, 87, 72, 0.06)"
                    style={styles.sessionCardWatermark}
                  />
                  <View style={[styles.ticketNotchSmall, styles.notchLeftSmall]} />
                  <View style={[styles.ticketNotchSmall, styles.notchRightSmall]} />

                  {/* Two-Tone Ticket Date Stub */}
                  <View style={styles.ticketStub}>
                    <View
                      style={[
                        styles.ticketStubHeader,
                        { backgroundColor: isTeach ? '#245748' : '#E84828' },
                      ]}
                    >
                      <Text style={styles.ticketStubMonth}>{monthStr}</Text>
                    </View>
                    <View style={styles.ticketStubBody}>
                      <Text style={styles.ticketStubNumber}>{dateNumStr}</Text>
                      <Text style={styles.ticketStubDay}>{dayStr.toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.ticketVerticalDivider} />

                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTopic} numberOfLines={1}>
                      {session.skill_name}
                    </Text>

                    <View style={styles.sessionMetaRow}>
                      <Ionicons name="person-circle-outline" size={14} color="#526159" />
                      <Text style={styles.sessionPartner} numberOfLines={1}>
                        with {session.partner_name}
                      </Text>
                    </View>

                    <View style={styles.sessionMetaRow}>
                      <Ionicons name="time-outline" size={13} color="#245748" />
                      <Text style={styles.sessionTime}>{timeStr} · 60 min</Text>
                    </View>
                  </View>

                  <View style={isTeach ? styles.teachingTag : styles.learningTag}>
                    <Ionicons
                      name={isTeach ? 'briefcase' : 'school'}
                      size={11}
                      color={isTeach ? '#8A5B1D' : '#245748'}
                    />
                    <Text style={isTeach ? styles.teachingTagText : styles.learningTagText}>
                      {session.mode}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptySessionBox}>
              <Ionicons name="calendar-clear-outline" size={28} color="#9BA8A0" />
              <Text style={styles.emptySessionText}>No upcoming sessions scheduled.</Text>
            </View>
          )}
        </View>

        {/* Recommended Classes Section Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIconTile}>
              <Ionicons name="sparkles-outline" size={17} color="#152822" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Recommended classes</Text>
              <Text style={styles.sectionSubtitle}>Picked for your interests</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.seeAllPill}
            onPress={() =>
              router.push({
                pathname: '/explore',
                params: { userId: String(targetId) },
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>Explore</Text>
            <Ionicons name="chevron-forward" size={12} color="#F05A28" />
          </TouchableOpacity>
        </View>

        {/* Horizontal Recommended Class Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recommendations}
        >
          {recommendedClasses.length > 0 ? (
            recommendedClasses.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.recommendationCard}
                onPress={() =>
                  router.push({
                    pathname: '/explore',
                    params: { userId: String(targetId) },
                  })
                }
                accessibilityRole="button"
              >
                <Ionicons
                  name={item.iconName}
                  size={54}
                  color="rgba(36, 87, 72, 0.06)"
                  style={styles.recWatermark}
                />

                <View style={styles.recTopRow}>
                  <View style={[styles.classMark, { backgroundColor: item.tint }]}>
                    <Ionicons name={item.iconName} size={20} color="#152822" />
                  </View>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.classCategory}>{item.category}</Text>
                  </View>
                </View>

                <Text style={styles.classTitle} numberOfLines={1}>
                  {item.title}
                </Text>

                <View style={styles.teacherMetaRow}>
                  <Ionicons name="person-outline" size={12} color="#6C7A72" />
                  <Text style={styles.classTeacher} numberOfLines={1}>
                    {item.teacher}
                  </Text>
                  <Ionicons name="star" size={11} color="#F2AC3C" />
                  <Text style={styles.ratingText}>4.9</Text>
                </View>

                <View style={styles.classFooter}>
                  <View style={styles.costPill}>
                    <Ionicons name="ellipse" size={8} color="#F2AC3C" />
                    <Text style={styles.classCost}>{item.coins} coins</Text>
                  </View>

                  <View style={styles.viewClassPill}>
                    <Text style={styles.classLink}>View</Text>
                    <Ionicons name="chevron-forward" size={11} color="#FFFFFF" />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={{ color: '#70776F', fontSize: 13, paddingVertical: 10 }}>
              No recommended classes available right now.
            </Text>
          )}
        </ScrollView>
      </ScrollView>

      {/* Offer a Skill Modal Form */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalIconBadge}>
                  <Ionicons name="bulb" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.modalTitle}>Offer a New Skill</Text>
              </View>
              <TouchableOpacity
                style={styles.closeCircleButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={18} color="#152822" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Skill Name</Text>
              <View style={styles.modalInputRow}>
                <Ionicons name="school-outline" size={17} color="#7C8178" />
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. React Native, Guitar, French"
                  placeholderTextColor="#A5A3B2"
                  value={skillName}
                  onChangeText={setSkillName}
                />
              </View>

              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.modalInputRow}>
                <Ionicons name="grid-outline" size={17} color="#7C8178" />
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Programming, Languages, Music"
                  placeholderTextColor="#A5A3B2"
                  value={category}
                  onChangeText={setCategory}
                />
              </View>

              <Text style={styles.formLabel}>Type</Text>
              <View style={styles.chipRow}>
                {(['Academic', 'Lifestyle'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, skillType === type && styles.chipSelected]}
                    onPress={() => setSkillType(type)}
                  >
                    <Ionicons
                      name={type === 'Academic' ? 'book-outline' : 'leaf-outline'}
                      size={13}
                      color={skillType === type ? '#FFFFFF' : '#526159'}
                    />
                    <Text style={[styles.chipText, skillType === type && styles.chipTextSelected]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Proficiency Level</Text>
              <View style={styles.chipRow}>
                {['Beginner', 'Intermediate', 'Advanced', 'Expert'].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[styles.chip, proficiencyLevel === level && styles.chipSelected]}
                    onPress={() => setProficiencyLevel(level)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        proficiencyLevel === level && styles.chipTextSelected,
                      ]}
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Coins Requested</Text>
              <View style={styles.modalInputRow}>
                <Ionicons name="cash-outline" size={17} color="#7C8178" />
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 25"
                  placeholderTextColor="#A5A3B2"
                  keyboardType="numeric"
                  value={coinRequest}
                  onChangeText={setCoinRequest}
                />
              </View>

              {formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}

              <TouchableOpacity
                style={[styles.submitButton, submitting && { opacity: 0.7 }]}
                disabled={submitting}
                onPress={handleOfferSkillSubmit}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Publish Skill Offer</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 128 },

  /* Editorial Hero Banner */
  heroBanner: {
    backgroundColor: '#F9ECDC',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
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
  heroWatermark: {
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
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  titleSparkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcome: {
    color: '#152822',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  titleSparkIcon: {
    marginLeft: 6,
    marginTop: -6,
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

  /* Ticket-Stub Quick Action Cards */
  quickActions: {
    flexDirection: 'row',
    gap: 11,
    marginBottom: 22,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
    elevation: 2,
  },
  learnActionCard: {
    backgroundColor: '#FFF5F1',
    borderColor: '#F2CFC3',
  },
  teachActionCard: {
    backgroundColor: '#F3F8F1',
    borderColor: '#CBE0C8',
  },
  actionWatermark: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    transform: [{ rotate: '-12deg' }],
  },
  ticketNotchSmall: {
    position: 'absolute',
    top: '52%',
    marginTop: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FDF6EC',
    borderWidth: 1,
    borderColor: '#EADCCE',
  },
  notchLeftSmall: { left: -6 },
  notchRightSmall: { right: -6 },

  actionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTagPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  actionLabel: {
    color: '#B84E38',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  teachLabel: {
    color: '#245748',
  },
  actionTitle: {
    color: '#152822',
    fontSize: 16,
    fontWeight: '900',
  },
  actionDescription: {
    color: '#526159',
    fontSize: 11,
    marginTop: 3,
  },
  actionCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  actionCtaText: {
    fontSize: 11,
    fontWeight: '800',
  },

  /* Section Headers */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
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
  sectionTitle: {
    color: '#152822',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: '#6C7A72',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  seeAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFCF8',
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  linkText: {
    color: '#F05A28',
    fontSize: 11,
    fontWeight: '800',
  },

  /* Upcoming Session Ticket Cards */
  sessionListContainer: {
    marginBottom: 22,
  },
  sessionTicketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFCF8',
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sessionCardWatermark: {
    position: 'absolute',
    right: 8,
    bottom: -4,
    transform: [{ rotate: '-12deg' }],
  },
  ticketStub: {
    width: 50,
    borderRadius: 9,
    backgroundColor: '#F9F3EA',
    borderWidth: 1,
    borderColor: '#E5D8C7',
    overflow: 'hidden',
  },
  ticketStubHeader: {
    paddingVertical: 3,
    alignItems: 'center',
  },
  ticketStubMonth: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ticketStubBody: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  ticketStubNumber: {
    color: '#152822',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  ticketStubDay: {
    color: '#526159',
    fontSize: 8,
    fontWeight: '800',
  },
  ticketVerticalDivider: {
    width: 1,
    height: 48,
    backgroundColor: '#E8C4B0',
    marginHorizontal: 11,
  },
  sessionInfo: {
    flex: 1,
    minWidth: 0,
  },
  sessionTopic: {
    color: '#152822',
    fontSize: 15,
    fontWeight: '900',
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  sessionPartner: {
    color: '#526159',
    fontSize: 12,
    fontWeight: '500',
  },
  sessionTime: {
    color: '#245748',
    fontSize: 11,
    fontWeight: '700',
  },
  learningTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCECD9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginLeft: 6,
  },
  learningTagText: {
    color: '#245748',
    fontSize: 9,
    fontWeight: '800',
  },
  teachingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDE8C8',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginLeft: 6,
  },
  teachingTagText: {
    color: '#8A5B1D',
    fontSize: 9,
    fontWeight: '800',
  },
  emptySessionBox: {
    backgroundColor: '#FFFCF8',
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptySessionText: {
    color: '#70776F',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },

  /* Recommended Classes Cards */
  recommendations: {
    gap: 11,
    paddingBottom: 6,
  },
  recommendationCard: {
    width: 232,
    backgroundColor: '#FFFCF8',
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderRadius: 18,
    padding: 15,
    overflow: 'hidden',
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
    elevation: 2,
  },
  recWatermark: {
    position: 'absolute',
    right: -6,
    bottom: 24,
    transform: [{ rotate: '-10deg' }],
  },
  recTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  classMark: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  categoryBadge: {
    backgroundColor: '#F4EDE2',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  classCategory: {
    color: '#526159',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  classTitle: {
    color: '#152822',
    fontSize: 17,
    fontWeight: '900',
  },
  teacherMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  classTeacher: {
    flex: 1,
    color: '#6C7A72',
    fontSize: 12,
    fontWeight: '500',
  },
  ratingText: {
    color: '#152822',
    fontSize: 11,
    fontWeight: '800',
  },
  classFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F2EAE0',
    paddingTop: 10,
    marginTop: 12,
  },
  costPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FDE8C8',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  classCost: {
    color: '#8A5B1D',
    fontSize: 11,
    fontWeight: '800',
  },
  viewClassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F05A28',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  classLink: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  /* Offer a Skill Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(21, 40, 34, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFCF8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: '#EADCCE',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#245748',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#152822',
  },
  closeCircleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4EDE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#29483F',
    marginTop: 14,
    marginBottom: 6,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EADCCE',
    backgroundColor: '#FDF6EC',
  },
  modalInput: {
    flex: 1,
    color: '#152822',
    fontSize: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FDF6EC',
    borderWidth: 1,
    borderColor: '#EADCCE',
  },
  chipSelected: {
    backgroundColor: '#214E41',
    borderColor: '#214E41',
  },
  chipText: {
    fontSize: 12,
    color: '#526159',
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  formErrorText: {
    color: '#B4233A',
    fontSize: 13,
    marginTop: 12,
    fontWeight: '600',
  },
  submitButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 25,
    backgroundColor: '#F05A28',
    marginTop: 22,
    marginBottom: 10,
    shadowColor: '#F05A28',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});