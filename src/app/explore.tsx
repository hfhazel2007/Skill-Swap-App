import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import Navigation from './navbar';

const categories = [
  { key: 'All', label: 'All', icon: 'apps-outline' as const, activeIcon: 'apps' as const },
  {
    key: 'Academic',
    label: 'Academic',
    icon: 'book-outline' as const,
    activeIcon: 'book' as const,
  },
  {
    key: 'Lifestyle',
    label: 'Lifestyle',
    icon: 'leaf-outline' as const,
    activeIcon: 'leaf' as const,
  },
] as const;

type Category = (typeof categories)[number]['key'];

export interface SkillItem {
  id: number;
  title: string;
  category: string;
  skillType: string;
  teacher: string;
  teacherId: number;
  expertise: string;
  rating: string;
  sessions: number;
  duration: string;
  coins: number;
  mark: string;
  tint: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

type Question = {
  id: string;
  askedBy: string;
  question: string;
  answer?: string;
};

const initialQuestions: Record<string, Question[]> = {
  'React Native': [
    {
      id: 'rn-1',
      askedBy: 'Jordan',
      question: 'Is this suitable for beginner developers?',
      answer: 'Yes, we cover basic components, state management, and Expo navigation.',
    },
  ],
};

const TINT_PALETTE = ['#DCECD9', '#FDE8C8', '#FADBD4', '#E3E6F8', '#DFF0F5'];

function getSkillIcon(categoryOrTitle: string): keyof typeof Ionicons.glyphMap {
  const q = categoryOrTitle.toLowerCase();
  if (
    q.includes('code') ||
    q.includes('program') ||
    q.includes('react') ||
    q.includes('java') ||
    q.includes('sql') ||
    q.includes('swift')
  ) {
    return 'code-slash-outline';
  }
  if (q.includes('design') || q.includes('ui') || q.includes('art') || q.includes('photo')) {
    return 'color-palette-outline';
  }
  if (q.includes('music') || q.includes('guitar') || q.includes('piano')) {
    return 'musical-notes-outline';
  }
  if (
    q.includes('spanish') ||
    q.includes('french') ||
    q.includes('language') ||
    q.includes('english')
  ) {
    return 'language-outline';
  }
  if (q.includes('yoga') || q.includes('fitness') || q.includes('lifestyle') || q.includes('cook')) {
    return 'leaf-outline';
  }
  return 'school-outline';
}

function shuffleItems<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function ExploreScreen() {
  const router = useRouter();
  const { userId, recommendedSkills, fromFindTeacher } = useLocalSearchParams<{
    userId?: string;
    recommendedSkills?: string;
    fromFindTeacher?: string;
  }>();

  const rawId = Array.isArray(userId) ? userId[0] : userId;
  const currentUserId = rawId && rawId !== 'undefined' ? parseInt(rawId, 10) : 1001;

  const isFromFindTeacher =
    (Array.isArray(fromFindTeacher) ? fromFindTeacher[0] : fromFindTeacher) === 'true' ||
    recommendedSkills !== undefined;

  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dbSkills, setDbSkills] = useState<SkillItem[]>([]);
  const [coinBalance, setCoinBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState(initialQuestions);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchMarketplaceData() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch user coin balance
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('coin_balance')
          .eq('id', currentUserId)
          .maybeSingle();

        if (userError) {
          console.error('Error fetching coin balance:', userError);
        } else if (userData) {
          setCoinBalance(userData.coin_balance ?? 0);
        }

        // 2. Fetch offered skills joined with skills and users tables
        const { data: offeredData, error: offeredError } = await supabase
          .from('offered_skills')
          .select(`
            id,
            user_id,
            skill_id,
            type,
            proficiency_level,
            coin_request,
            skills!inner (
              id,
              name,
              category,
              skill_type
            ),
            users!inner (
              id,
              full_name,
              bio
            )
          `)
          .eq('type', 'OFFERED')
          .neq('user_id', currentUserId);

        if (offeredError) throw offeredError;

        const formattedSkills: SkillItem[] = (offeredData || []).map((row: any, index: number) => {
          const skillName = row.skills?.name || 'Skill';
          const shortMark = skillName.substring(0, 4).toUpperCase();
          const skillType = row.skills?.skill_type || row.skills?.category || 'Academic';

          return {
            id: row.id,
            title: skillName,
            category: skillType,
            skillType,
            teacher: row.users?.full_name || 'Community Peer',
            teacherId: row.user_id,
            expertise: row.proficiency_level ? `${row.proficiency_level} tutor` : 'Instructor',
            rating: '4.9',
            sessions: 12 + (row.id % 15),
            duration: '45 min',
            coins: row.coin_request ?? 25,
            mark: shortMark,
            tint: TINT_PALETTE[index % TINT_PALETTE.length],
            iconName: getSkillIcon(`${skillType} ${skillName}`),
          };
        });

        setDbSkills(formattedSkills);
      } catch (err: any) {
        console.error('Error fetching marketplace data:', err);
        setError(err.message || 'Failed to load skills marketplace');
      } finally {
        setLoading(false);
      }
    }

    fetchMarketplaceData();
  }, [userId]);

  const requestedSkills: string[] = (
    Array.isArray(recommendedSkills) ? recommendedSkills[0] : recommendedSkills || ''
  )
    .split(',')
    .map((skill: string) => skill.trim().toLowerCase())
    .filter(Boolean);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchesActiveFilters = (skill: SkillItem) => {
    const matchesCategory =
      activeCategory === 'All' ||
      skill.category.toLowerCase() === activeCategory.toLowerCase();
    const matchesQuery = `${skill.title} ${skill.teacher} ${skill.expertise}`
      .toLowerCase()
      .includes(normalizedQuery);
    return matchesCategory && matchesQuery;
  };

  const isRequestedMatch = (skill: SkillItem) =>
    requestedSkills.some(
      (requestedSkill) =>
        `${skill.title} ${skill.category}`.toLowerCase().includes(requestedSkill) ||
        requestedSkill.includes(skill.title.toLowerCase())
    );

  // Split matched teachers vs. randomized remaining teachers when arriving from "Find a teacher"
  const { primarySkills, otherRandomSkills } = useMemo(() => {
    const filteredAll = dbSkills.filter(matchesActiveFilters);

    if (!isFromFindTeacher) {
      return {
        primarySkills: filteredAll,
        otherRandomSkills: [] as SkillItem[],
      };
    }

    if (requestedSkills.length === 0) {
      return {
        primarySkills: [] as SkillItem[],
        otherRandomSkills: shuffleItems(filteredAll),
      };
    }

    const matched = filteredAll.filter(isRequestedMatch);
    const nonMatched = filteredAll.filter((skill) => !isRequestedMatch(skill));

    return {
      primarySkills: matched,
      otherRandomSkills: shuffleItems(nonMatched),
    };
  }, [dbSkills, activeCategory, normalizedQuery, isFromFindTeacher, recommendedSkills]);

  const submitQuestion = (skillTitle: string) => {
    const question = questionDrafts[skillTitle]?.trim();
    if (!question) return;

    setQuestions((current) => ({
      ...current,
      [skillTitle]: [
        ...(current[skillTitle] || []),
        {
          id: `${skillTitle}-${Date.now()}`,
          askedBy: 'You',
          question,
        },
      ],
    }));
    setQuestionDrafts((current) => ({ ...current, [skillTitle]: '' }));
  };

  const renderSkillCard = (skill: SkillItem) => {
    const isExpanded = expandedSkill === skill.title;
    return (
      <View key={`${skill.id}-${skill.title}`} style={styles.skillTicketCard}>
        {/* Subtle Watermark & Perforated Side Notches */}
        <Ionicons
          name={skill.iconName}
          size={68}
          color="rgba(36, 87, 72, 0.05)"
          style={styles.cardWatermark}
        />
        <View style={[styles.ticketNotch, styles.ticketNotchLeft]} />
        <View style={[styles.ticketNotch, styles.ticketNotchRight]} />

        <View style={styles.skillTopRow}>
          <View style={[styles.skillMark, { backgroundColor: skill.tint }]}>
            <Ionicons name={skill.iconName} size={22} color="#152822" />
          </View>

          <View style={styles.skillHeading}>
            <View style={styles.catTagRow}>
              <Text style={styles.skillCategory}>{skill.category.toUpperCase()}</Text>
            </View>
            <Text style={styles.skillTitle} numberOfLines={1}>
              {skill.title}
            </Text>
          </View>

          <View style={styles.priceBadge}>
            <Ionicons name="ellipse" size={8} color="#F2AC3C" />
            <Text style={styles.priceText}>{skill.coins} coins</Text>
          </View>
        </View>

        <View style={styles.teacherRow}>
          <Ionicons name="person-circle-outline" size={16} color="#245748" />
          <Text style={styles.teacher} numberOfLines={1}>
            {skill.teacher} · <Text style={styles.expertiseText}>{skill.expertise}</Text>
          </Text>
        </View>

        <View style={styles.skillBottomRow}>
          <View style={styles.skillMeta}>
            <View style={styles.metaChip}>
              <Ionicons name="star" size={12} color="#F2AC3C" />
              <Text style={styles.rating}>{skill.rating}</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="people-outline" size={12} color="#6C7A72" />
              <Text style={styles.metaText}>{skill.sessions}</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={12} color="#6C7A72" />
              <Text style={styles.metaText}>{skill.duration}</Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.questionButton, isExpanded && styles.questionButtonActive]}
              accessibilityRole="button"
              accessibilityLabel={`Ask a question about ${skill.title}`}
              onPress={() => setExpandedSkill(isExpanded ? null : skill.title)}
            >
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chatbubble-ellipses-outline'}
                size={13}
                color="#245748"
              />
              <Text style={styles.questionButtonText}>
                {isExpanded ? 'Hide Q&A' : 'Ask'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bookButton}
              accessibilityRole="button"
              accessibilityLabel={`Book ${skill.title}`}
            >
              <Text style={styles.bookButtonText}>Book now</Text>
              <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Class Q&A Drawer */}
        {isExpanded && (
          <View style={styles.qaSection}>
            <View style={styles.qaHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.qaTitleRow}>
                  <Ionicons name="help-buoy-outline" size={15} color="#245748" />
                  <Text style={styles.qaTitle}>Class Q&A</Text>
                  <View style={styles.qaCountPill}>
                    <Text style={styles.qaCount}>{questions[skill.title]?.length || 0}</Text>
                  </View>
                </View>
                <Text style={styles.qaSubtitle}>
                  Questions and answers are visible to everyone.
                </Text>
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Message ${skill.teacher} about ${skill.title}`}
                onPress={() =>
                  router.push({
                    pathname: '/messages',
                    params: {
                      userId: String(currentUserId),
                      targetUserId: String(skill.teacherId),
                      conversation: skill.teacher,
                      question:
                        questionDrafts[skill.title]?.trim() ||
                        `I have a question about ${skill.title}.`,
                    },
                  })
                }
                style={styles.messageOwnerButton}
              >
                <Ionicons name="paper-plane-outline" size={12} color="#245748" />
                <Text style={styles.messageOwnerText}>Message owner</Text>
              </TouchableOpacity>
            </View>

            {(questions[skill.title] || []).length > 0 ? (
              <View style={styles.questionList}>
                {questions[skill.title].map((item) => (
                  <View key={item.id} style={styles.questionItem}>
                    <View style={styles.questionPromptRow}>
                      <Ionicons name="help-circle" size={14} color="#245748" />
                      <Text style={styles.questionText}>
                        <Text style={styles.questionAuthor}>{item.askedBy}: </Text>
                        {item.question}
                      </Text>
                    </View>
                    <View
                      style={[styles.answerBox, !item.answer && styles.pendingAnswerBox]}
                    >
                      <Text style={styles.answerLabel}>OWNER REPLY</Text>
                      <Text style={styles.answerText}>
                        {item.answer || 'The owner has not replied yet.'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyQuestions}>Be the first to ask about this class.</Text>
            )}

            <View style={styles.questionComposer}>
              <TextInput
                value={questionDrafts[skill.title] || ''}
                onChangeText={(text) =>
                  setQuestionDrafts((current) => ({ ...current, [skill.title]: text }))
                }
                style={styles.questionInput}
                placeholder="Ask the class owner..."
                placeholderTextColor="#9A9C94"
                multiline
                maxLength={240}
                accessibilityLabel={`Question about ${skill.title}`}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Post question about ${skill.title}`}
                onPress={() => submitQuestion(skill.title)}
                disabled={!questionDrafts[skill.title]?.trim()}
                style={[
                  styles.postButton,
                  !questionDrafts[skill.title]?.trim() && styles.disabledPostButton,
                ]}
              >
                <Text style={styles.postButtonText}>Post</Text>
                <Ionicons name="send" size={11} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const hasAnyResults = primarySkills.length > 0 || otherRandomSkills.length > 0;

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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial Hero Header */}
        <View style={styles.heroHeader}>
          <Ionicons
            name="compass-outline"
            size={70}
            color="rgba(240, 90, 40, 0.08)"
            style={styles.headerWatermark}
          />
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowIconBadge}>
              <Ionicons name="compass" size={14} color="#FFFFFF" />
            </View>
            <Text style={styles.eyebrow}>
              {isFromFindTeacher ? 'MATCHED FOR YOUR LEARNING GOALS' : 'SKILL SWAP MARKETPLACE'}
            </Text>
          </View>

          <View style={styles.titleSparkRow}>
            <Text style={styles.title}>Find your next skill</Text>
            <Ionicons name="sparkles" size={19} color="#F05A28" style={styles.titleSparkIcon} />
          </View>

          <Text style={styles.subtitle}>
            {isFromFindTeacher
              ? 'Available teachers for your requested skills, plus more to discover.'
              : 'Learn something new. Teach something you love.'}
          </Text>
          <View style={styles.titleAccentBar} />
        </View>

        {/* Elevated Search Box */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#6C7A72" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search skills, topics or people..."
            placeholderTextColor="#8D958E"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            accessibilityLabel="Search skills, topics or people"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: 6 }}>
              <Ionicons name="close-circle" size={18} color="#9A9C94" />
            </TouchableOpacity>
          )}
          <View style={styles.filterBadge}>
            <Image
              source={require('../../assets/headerIcon/filter.png')}
              style={styles.filterIcon}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Pill Category Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {categories.map((cat) => {
            const isSelected = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setActiveCategory(cat.key)}
                style={[styles.categoryPill, isSelected && styles.categoryPillSelected]}
              >
                <Ionicons
                  name={isSelected ? cat.activeIcon : cat.icon}
                  size={15}
                  color={isSelected ? '#FFFFFF' : '#29483F'}
                />
                <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Section Subheader */}
        <View style={styles.resultsHeader}>
          <View style={styles.resultsTitleRow}>
            <View style={styles.sectionIconTile}>
              <Ionicons name="sparkles-outline" size={17} color="#152822" />
            </View>
            <View>
              <Text style={styles.resultsTitle}>
                {isFromFindTeacher ? 'Available teachers for you' : 'Recommended for you'}
              </Text>
              <Text style={styles.resultsCount}>
                {isFromFindTeacher
                  ? `${primarySkills.length} matching teacher${primarySkills.length !== 1 ? 's' : ''}`
                  : `${primarySkills.length} skill${primarySkills.length !== 1 ? 's' : ''} to explore`}
              </Text>
            </View>
          </View>
          <View style={styles.sortPill}>
            <Ionicons name="flame" size={11} color="#F05A28" />
            <Text style={styles.sortLabel}>TOP MATCH</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#F05A28" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={30} color="#B84E38" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : hasAnyResults ? (
          <>
            {/* Primary / Matched Teachers */}
            {primarySkills.length > 0 ? (
              primarySkills.map(renderSkillCard)
            ) : isFromFindTeacher ? (
              <View style={styles.noMatchNoticeCard}>
                <Ionicons name="information-circle-outline" size={20} color="#8A5B1D" />
                <Text style={styles.noMatchNoticeText}>
                  No exact teachers available for your requested skills right now. Check out other available teachers below!
                </Text>
              </View>
            ) : null}

            {/* Divider Line + Random Other Teachers & Skills when directed from "Find a teacher" */}
            {isFromFindTeacher && otherRandomSkills.length > 0 && (
              <>
                <View style={styles.sectionDividerContainer}>
                  <View style={styles.sectionDividerLine} />
                  <View style={styles.sectionDividerBadge}>
                    <Ionicons name="shuffle-outline" size={13} color="#245748" />
                    <Text style={styles.sectionDividerText}>
                      OTHER AVAILABLE TEACHERS & SKILLS
                    </Text>
                  </View>
                  <View style={styles.sectionDividerLine} />
                </View>

                <View style={styles.moreHeader}>
                  <Text style={styles.moreTitle}>Explore more teachers</Text>
                  <Text style={styles.moreSubtitle}>
                    {otherRandomSkills.length} other skill{otherRandomSkills.length !== 1 ? 's' : ''} available right now
                  </Text>
                </View>

                {otherRandomSkills.map(renderSkillCard)}
              </>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="search-outline" size={30} color="#F05A28" />
            </View>
            <Text style={styles.emptyTitle}>No skills found</Text>
            <Text style={styles.emptyCopy}>Try another search term or category.</Text>
          </View>
        )}
      </ScrollView>

      <Navigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF6EC',
  },
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
  logoIcon: {
    width: 116,
    height: 58,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerIcon: {
    width: 34,
    height: 34,
  },
  coinView: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2AC3C',
    borderRadius: 18,
    paddingHorizontal: 8,
  },
  coinIcon: {
    width: 20,
    height: 28,
  },
  coinCount: {
    color: '#30291F',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 124,
  },

  /* Editorial Hero Header */
  heroHeader: {
    marginBottom: 16,
    position: 'relative',
  },
  headerWatermark: {
    position: 'absolute',
    right: 6,
    top: -4,
    transform: [{ rotate: '14deg' }],
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
    letterSpacing: 1.1,
  },
  titleSparkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#152822',
    fontSize: 29,
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
  titleAccentBar: {
    width: 68,
    height: 3,
    backgroundColor: '#F29F38',
    borderRadius: 2,
    marginTop: 8,
  },

  /* Elevated Search Box */
  searchBox: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFCF8',
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 10,
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 48,
    color: '#152822',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  filterBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F4EDE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIcon: {
    width: 18,
    height: 18,
  },

  /* Pill Categories */
  categoryList: {
    gap: 8,
    paddingVertical: 15,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#FFFCF8',
  },
  categoryPillSelected: {
    borderColor: '#F05A28',
    backgroundColor: '#F05A28',
    shadowColor: '#F05A28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  categoryText: {
    color: '#29483F',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  /* Results Section Header */
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  resultsTitleRow: {
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
  resultsTitle: {
    color: '#152822',
    fontSize: 18,
    fontWeight: '900',
  },
  resultsCount: {
    color: '#6C7A72',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDE8DF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  sortLabel: {
    color: '#D94B1E',
    fontSize: 10,
    fontWeight: '800',
  },

  /* Notice when no exact match found */
  noMatchNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF5E4',
    borderWidth: 1,
    borderColor: '#F2D6A7',
    borderRadius: 14,
    padding: 13,
    marginBottom: 6,
  },
  noMatchNoticeText: {
    flex: 1,
    color: '#7A4D14',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },

  /* Horizontal Divider Line for Other Random Teachers */
  sectionDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 16,
  },
  sectionDividerLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#E2D3BE',
  },
  sectionDividerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFE5D6',
    borderWidth: 1,
    borderColor: '#DFD0BC',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginHorizontal: 8,
  },
  sectionDividerText: {
    color: '#245748',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  moreHeader: {
    marginBottom: 12,
  },
  moreTitle: {
    color: '#152822',
    fontSize: 17,
    fontWeight: '900',
  },
  moreSubtitle: {
    color: '#6C7A72',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  /* Ticket-Stub Marketplace Skill Card */
  skillTicketCard: {
    backgroundColor: '#FFFCF8',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EADCCE',
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardWatermark: {
    position: 'absolute',
    right: 8,
    bottom: 34,
    transform: [{ rotate: '-12deg' }],
  },
  ticketNotch: {
    position: 'absolute',
    top: '50%',
    marginTop: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FDF6EC',
    borderWidth: 1,
    borderColor: '#EADCCE',
  },
  ticketNotchLeft: { left: -7 },
  ticketNotchRight: { right: -7 },

  skillTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skillMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  skillHeading: {
    flex: 1,
    minWidth: 0,
  },
  catTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  skillCategory: {
    color: '#D94B1E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  skillTitle: {
    color: '#152822',
    fontSize: 18,
    fontWeight: '900',
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FDE8C8',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  priceText: {
    color: '#8A5B1D',
    fontSize: 12,
    fontWeight: '800',
  },
  teacherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 11,
    marginBottom: 13,
  },
  teacher: {
    flex: 1,
    color: '#29483F',
    fontSize: 13,
    fontWeight: '700',
  },
  expertiseText: {
    color: '#6C7A72',
    fontWeight: '500',
  },
  skillBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F2EAE0',
    paddingTop: 12,
  },
  skillMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F5EFE6',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  rating: {
    color: '#152822',
    fontSize: 11,
    fontWeight: '800',
  },
  metaText: {
    color: '#526159',
    fontSize: 11,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: 8,
  },
  questionButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#DCECD9',
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  questionButtonActive: {
    backgroundColor: '#C8E1C4',
  },
  questionButtonText: {
    color: '#245748',
    fontSize: 12,
    fontWeight: '800',
  },
  bookButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F05A28',
    borderRadius: 18,
    paddingHorizontal: 14,
    shadowColor: '#F05A28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Expandable Class Q&A Section */
  qaSection: {
    borderTopWidth: 1,
    borderTopColor: '#EFE6D8',
    marginTop: 14,
    paddingTop: 14,
  },
  qaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  qaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qaTitle: {
    color: '#152822',
    fontSize: 15,
    fontWeight: '900',
  },
  qaCountPill: {
    backgroundColor: '#FADBD4',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  qaCount: {
    color: '#B84E38',
    fontSize: 11,
    fontWeight: '800',
  },
  qaSubtitle: {
    color: '#7C8178',
    fontSize: 11,
    marginTop: 3,
  },
  messageOwnerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCECD9',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  messageOwnerText: {
    color: '#245748',
    fontSize: 11,
    fontWeight: '800',
  },
  questionList: {
    marginTop: 12,
    gap: 9,
  },
  questionItem: {
    backgroundColor: '#FDF6EC',
    borderWidth: 1,
    borderColor: '#EFE6D8',
    borderRadius: 12,
    padding: 11,
  },
  questionPromptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  questionText: {
    flex: 1,
    color: '#152822',
    fontSize: 12,
    lineHeight: 18,
  },
  questionAuthor: {
    color: '#245748',
    fontWeight: '800',
  },
  answerBox: {
    backgroundColor: '#DCECD9',
    borderRadius: 9,
    padding: 9,
    marginTop: 8,
  },
  pendingAnswerBox: {
    backgroundColor: '#F3ECE0',
  },
  answerLabel: {
    color: '#245748',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 3,
  },
  answerText: {
    color: '#30463D',
    fontSize: 12,
    lineHeight: 16,
  },
  emptyQuestions: {
    color: '#7C8178',
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic',
  },
  questionComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  questionInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 76,
    backgroundColor: '#FDF6EC',
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#152822',
    fontSize: 12,
  },
  postButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F05A28',
  },
  disabledPostButton: {
    backgroundColor: '#D9D4CA',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* Empty & Error States */
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFCF8',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EADCCE',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FDE8DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#152822',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyCopy: {
    color: '#7C8178',
    fontSize: 13,
    marginTop: 4,
  },
  errorCard: {
    alignItems: 'center',
    backgroundColor: '#FFFCF8',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EADCCE',
    padding: 24,
  },
  errorText: {
    color: '#B84E38',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
});