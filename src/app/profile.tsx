import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

interface JoinedSkill {
  id: number;
  skills:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
}

interface SkillBadgeItem {
  recordId: number;
  name: string;
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

function mapSkillItems(list?: JoinedSkill[]): SkillBadgeItem[] {
  if (!list) return [];
  return list
    .map((item) => {
      if (!item.skills) return null;
      const name = Array.isArray(item.skills) ? item.skills[0]?.name : item.skills.name;
      if (!name) return null;
      return { recordId: item.id, name };
    })
    .filter((item): item is SkillBadgeItem => item !== null);
}

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
  const [offeredSkills, setOfferedSkills] = useState<SkillBadgeItem[]>([]);
  const [wantedSkills, setWantedSkills] = useState<SkillBadgeItem[]>([]);

  // Add Skill Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'OFFERED' | 'WANTED'>('OFFERED');
  const [newSkillName, setNewSkillName] = useState('');
  const [newCategory, setNewCategory] = useState('Programming');
  const [newSkillType, setNewSkillType] = useState<'Academic' | 'Lifestyle'>('Academic');
  const [proficiencyLevel, setProficiencyLevel] = useState('Intermediate');
  const [coinRequest, setCoinRequest] = useState('25');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const rawId = Array.isArray(userId) ? userId[0] : userId;
  const targetId = rawId && rawId !== 'undefined' ? parseInt(rawId, 10) : 1001;

  async function fetchUserProfile() {
    try {
      setLoading(true);
      setError(null);

      if (Number.isNaN(targetId)) {
        setError('Invalid user ID');
        return;
      }

      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select(`
          id, full_name, email, avatar_url, bio, coin_balance, trust_rating, created_at,
          offered_skills (
            id,
            skills ( name )
          ),
          skill_requests (
            id,
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
      setOfferedSkills(mapSkillItems(rawUserData.offered_skills));
      setWantedSkills(mapSkillItems(rawUserData.skill_requests));
    } catch (fetchError) {
      console.error('Error fetching profile:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUserProfile();
  }, [userId]);

  const openAddModal = (mode: 'OFFERED' | 'WANTED') => {
    setModalMode(mode);
    setNewSkillName('');
    setNewCategory('Programming');
    setNewSkillType('Academic');
    setProficiencyLevel('Intermediate');
    setCoinRequest('25');
    setFormError('');
    setModalVisible(true);
  };

  const handleAddSkill = async () => {
    setFormError('');
    const trimmedName = newSkillName.trim();
    const parsedCoins = parseInt(coinRequest, 10);

    if (!trimmedName) {
      setFormError('Please enter a skill name.');
      return;
    }

    if (modalMode === 'OFFERED' && (Number.isNaN(parsedCoins) || parsedCoins < 0)) {
      setFormError('Please enter a valid coin amount.');
      return;
    }

    // Prevent duplicate entries in the same list
    const existingList = modalMode === 'OFFERED' ? offeredSkills : wantedSkills;
    if (existingList.some((s) => s.name.toLowerCase() === trimmedName.toLowerCase())) {
      setFormError(`"${trimmedName}" is already in this list.`);
      return;
    }

    setSubmitting(true);
    try {
      let targetSkillId: number;

      // 1. Check if the skill already exists in the `skills` table
      const { data: existingSkill, error: lookupError } = await supabase
        .from('skills')
        .select('id')
        .ilike('name', trimmedName)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existingSkill) {
        targetSkillId = existingSkill.id;
      } else {
        // 2. Create the skill in `skills` table if not found
        const { data: createdSkill, error: createError } = await supabase
          .from('skills')
          .insert({
            name: trimmedName,
            category: newCategory.trim() || 'General',
            skill_type: newSkillType,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        targetSkillId = createdSkill.id;
      }

      // 3. Insert into `offered_skills` or `skill_requests`
      if (modalMode === 'OFFERED') {
        const { data: insertedOffer, error: offerError } = await supabase
          .from('offered_skills')
          .insert({
            user_id: targetId,
            skill_id: targetSkillId,
            type: 'OFFERED',
            proficiency_level: proficiencyLevel,
            coin_request: parsedCoins,
          })
          .select('id')
          .single();

        if (offerError) throw offerError;

        setOfferedSkills((prev) => [
          ...prev,
          { recordId: insertedOffer.id, name: trimmedName },
        ]);
      } else {
        const { data: insertedRequest, error: requestError } = await supabase
          .from('skill_requests')
          .insert({
            user_id: targetId,
            skill_id: targetSkillId,
          })
          .select('id')
          .single();

        if (requestError) throw requestError;

        setWantedSkills((prev) => [
          ...prev,
          { recordId: insertedRequest.id, name: trimmedName },
        ]);
      }

      setModalVisible(false);
    } catch (err: any) {
      console.error('Error adding skill:', err);
      setFormError(err.message || 'Could not add skill.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeleteSkill = (mode: 'OFFERED' | 'WANTED', item: SkillBadgeItem) => {
    const performDelete = async () => {
      const key = `${mode}-${item.recordId}`;
      setDeletingKey(key);
      try {
        const table = mode === 'OFFERED' ? 'offered_skills' : 'skill_requests';
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('id', item.recordId);

        if (deleteError) throw deleteError;

        if (mode === 'OFFERED') {
          setOfferedSkills((prev) => prev.filter((s) => s.recordId !== item.recordId));
        } else {
          setWantedSkills((prev) => prev.filter((s) => s.recordId !== item.recordId));
        }
      } catch (err: any) {
        console.error('Error deleting skill:', err);
        if (Platform.OS === 'web') {
          window.alert(err.message || 'Failed to delete skill.');
        } else {
          Alert.alert('Error', err.message || 'Failed to delete skill.');
        }
      } finally {
        setDeletingKey(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${item.name}" from your profile?`)) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Remove Skill',
        `Remove "${item.name}" from your ${mode === 'OFFERED' ? 'offered' : 'learning'} skills?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  };

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
        {/* Editorial Hero Header */}
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
                {profile?.bio ||
                  'Tell the community a little about yourself and what you love to build or learn.'}
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
                  <View style={styles.titleWithCountRow}>
                    <Text style={styles.sectionTitle}>Skills I offer</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{offeredSkills.length}</Text>
                    </View>
                  </View>
                </View>

                {/* Add Offered Skill Button */}
                <TouchableOpacity
                  style={styles.addSkillButton}
                  onPress={() => openAddModal('OFFERED')}
                  accessibilityRole="button"
                  accessibilityLabel="Add skill I offer"
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.addSkillButtonText}>Add</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.skillList}>
                {offeredSkills.length > 0 ? (
                  offeredSkills.map((item, index) => {
                    const theme = teachingChipThemes[index % teachingChipThemes.length];
                    const isDeleting = deletingKey === `OFFERED-${item.recordId}`;
                    return (
                      <View
                        key={`offered-${item.recordId}`}
                        style={[
                          styles.skillChip,
                          { backgroundColor: theme.bg, borderColor: theme.border },
                        ]}
                      >
                        <Ionicons name="ribbon-outline" size={14} color={theme.icon} />
                        <Text style={[styles.skillChipText, { color: theme.text }]}>
                          {item.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => confirmDeleteSkill('OFFERED', item)}
                          disabled={isDeleting}
                          style={styles.chipDeleteBtn}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${item.name}`}
                        >
                          {isDeleting ? (
                            <ActivityIndicator size="small" color={theme.icon} />
                          ) : (
                            <Ionicons name="close-circle" size={16} color={theme.icon} />
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No skills listed yet. Tap + Add to share one.</Text>
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
                  <View style={styles.titleWithCountRow}>
                    <Text style={styles.sectionTitle}>Skills I’m seeking</Text>
                    <View style={[styles.countBadge, { backgroundColor: '#FDE8C8' }]}>
                      <Text style={[styles.countBadgeText, { color: '#8A5B1D' }]}>
                        {wantedSkills.length}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Add Learning Skill Button */}
                <TouchableOpacity
                  style={[styles.addSkillButton, { backgroundColor: '#F05A28' }]}
                  onPress={() => openAddModal('WANTED')}
                  accessibilityRole="button"
                  accessibilityLabel="Add skill I want to learn"
                >
                  <Ionicons name="add" size={16} color="#FFFFFF" />
                  <Text style={styles.addSkillButtonText}>Add</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.skillList}>
                {wantedSkills.length > 0 ? (
                  wantedSkills.map((item, index) => {
                    const theme = learningChipThemes[index % learningChipThemes.length];
                    const isDeleting = deletingKey === `WANTED-${item.recordId}`;
                    return (
                      <View
                        key={`wanted-${item.recordId}`}
                        style={[
                          styles.skillChip,
                          { backgroundColor: theme.bg, borderColor: theme.border },
                        ]}
                      >
                        <Ionicons name="sparkles-outline" size={13} color={theme.icon} />
                        <Text style={[styles.skillChipText, { color: theme.text }]}>
                          {item.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => confirmDeleteSkill('WANTED', item)}
                          disabled={isDeleting}
                          style={styles.chipDeleteBtn}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${item.name}`}
                        >
                          {isDeleting ? (
                            <ActivityIndicator size="small" color={theme.icon} />
                          ) : (
                            <Ionicons name="close-circle" size={16} color={theme.icon} />
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>
                    No learning goals listed yet. Tap + Add to add one.
                  </Text>
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

      {/* Add Skill Bottom Sheet Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View
                  style={[
                    styles.modalIconBadge,
                    { backgroundColor: modalMode === 'OFFERED' ? '#245748' : '#F05A28' },
                  ]}
                >
                  <Ionicons
                    name={modalMode === 'OFFERED' ? 'briefcase' : 'school'}
                    size={17}
                    color="#FFFFFF"
                  />
                </View>
                <Text style={styles.modalTitle}>
                  {modalMode === 'OFFERED' ? 'Add Skill to Teach' : 'Add Skill to Learn'}
                </Text>
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
                <Ionicons name="sparkles-outline" size={17} color="#7C8178" />
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. React Native, Spanish, Guitar"
                  placeholderTextColor="#A5A3B2"
                  value={newSkillName}
                  onChangeText={setNewSkillName}
                />
              </View>

              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.modalInputRow}>
                <Ionicons name="grid-outline" size={17} color="#7C8178" />
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Programming, Languages, Music"
                  placeholderTextColor="#A5A3B2"
                  value={newCategory}
                  onChangeText={setNewCategory}
                />
              </View>

              <Text style={styles.formLabel}>Type</Text>
              <View style={styles.chipRow}>
                {(['Academic', 'Lifestyle'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.modalChip, newSkillType === type && styles.modalChipSelected]}
                    onPress={() => setNewSkillType(type)}
                  >
                    <Ionicons
                      name={type === 'Academic' ? 'book-outline' : 'leaf-outline'}
                      size={13}
                      color={newSkillType === type ? '#FFFFFF' : '#526159'}
                    />
                    <Text
                      style={[
                        styles.modalChipText,
                        newSkillType === type && styles.modalChipTextSelected,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {modalMode === 'OFFERED' && (
                <>
                  <Text style={styles.formLabel}>Proficiency Level</Text>
                  <View style={styles.chipRow}>
                    {['Beginner', 'Intermediate', 'Advanced', 'Expert'].map((level) => (
                      <TouchableOpacity
                        key={level}
                        style={[
                          styles.modalChip,
                          proficiencyLevel === level && styles.modalChipSelected,
                        ]}
                        onPress={() => setProficiencyLevel(level)}
                      >
                        <Text
                          style={[
                            styles.modalChipText,
                            proficiencyLevel === level && styles.modalChipTextSelected,
                          ]}
                        >
                          {level}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.formLabel}>Coins Requested per Session</Text>
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
                </>
              )}

              {formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: modalMode === 'OFFERED' ? '#245748' : '#F05A28' },
                  submitting && { opacity: 0.7 },
                ]}
                disabled={submitting}
                onPress={handleAddSkill}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Save Skill</Text>
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
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 124 },

  /* Hero Header */
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
  titleWithCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
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
    borderRadius: 10,
    minWidth: 24,
    paddingVertical: 2,
    paddingHorizontal: 7,
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#245748',
    fontSize: 11,
    fontWeight: '800',
  },
  addSkillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#245748',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  addSkillButtonText: {
    color: '#FFFFFF',
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
    paddingLeft: 11,
    paddingRight: 8,
  },
  skillChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  chipDeleteBtn: {
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
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

  /* Add Skill Modal Styles */
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 19,
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
  modalChip: {
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
  modalChipSelected: {
    backgroundColor: '#214E41',
    borderColor: '#214E41',
  },
  modalChipText: {
    fontSize: 12,
    color: '#526159',
    fontWeight: '700',
  },
  modalChipTextSelected: {
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
    marginTop: 22,
    marginBottom: 10,
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
