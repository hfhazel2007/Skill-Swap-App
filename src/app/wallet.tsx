import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
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

const transactionFilters = [
  { key: 'All', label: 'All', icon: 'layers-outline' as const, activeIcon: 'layers' as const },
  {
    key: 'Earned',
    label: 'Earned',
    icon: 'arrow-down-circle-outline' as const,
    activeIcon: 'arrow-down-circle' as const,
  },
  {
    key: 'Spent',
    label: 'Spent',
    icon: 'arrow-up-circle-outline' as const,
    activeIcon: 'arrow-up-circle' as const,
  },
  {
    key: 'Pending',
    label: 'Pending',
    icon: 'time-outline' as const,
    activeIcon: 'time' as const,
  },
] as const;

type TransactionFilter = (typeof transactionFilters)[number]['key'];
type TransactionType = Exclude<TransactionFilter, 'All'>;

interface JoinedWalletTransaction {
  id: number;
  amount: number;
  type: TransactionType;
  description: string;
  created_at: string;
}

interface UserProfile {
  coin_balance: number;
  wallet_transactions: JoinedWalletTransaction[];
}

function normalizeTransactionType(rawType?: string): TransactionType {
  const normalized = (rawType || '').trim().toLowerCase();
  if (normalized === 'earned' || normalized === 'credit' || normalized === 'deposit') {
    return 'Earned';
  }
  if (normalized === 'spent' || normalized === 'debit' || normalized === 'withdraw') {
    return 'Spent';
  }
  return 'Pending';
}

function formatTransactionDate(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WalletScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [activeFilter, setActiveFilter] = useState<TransactionFilter>('All');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<JoinedWalletTransaction[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<JoinedWalletTransaction[]>([]);

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
            coin_balance,
            wallet_transactions (
              id,
              amount,
              transaction_type,
              description,
              created_at
            )
          `)
          .eq('id', targetId)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!userData) {
          setError('User profile not found.');
          return;
        }

        const mappedTransactions: JoinedWalletTransaction[] = (
          userData.wallet_transactions || []
        )
          .map((tx: any) => ({
            id: tx.id,
            amount: Number(tx.amount) || 0,
            type: normalizeTransactionType(tx.transaction_type || tx.type),
            description: tx.description || 'SkillSwap coin activity',
            created_at: tx.created_at,
          }))
          .sort(
            (a: JoinedWalletTransaction, b: JoinedWalletTransaction) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );

        setProfile({
          coin_balance: userData.coin_balance ?? 0,
          wallet_transactions: mappedTransactions,
        });
        setTransactions(mappedTransactions);
        setPendingTransactions(mappedTransactions.filter((tx) => tx.type === 'Pending'));
      } catch (fetchError) {
        console.error('Error fetching wallet:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchUserProfile();
  }, [userId]);

  const filteredTransactions =
    activeFilter === 'All'
      ? transactions
      : transactions.filter((tx) => tx.type === activeFilter);

  const pendingTotal = pendingTransactions.reduce((sum, tx) => sum + tx.amount, 0);

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
        {/* Editorial Hero Header matching Sessions & Profile */}
        <View style={styles.heroHeader}>
          <Ionicons
            name="wallet-outline"
            size={68}
            color="rgba(240, 90, 40, 0.08)"
            style={styles.headerWatermark}
          />
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowIconBadge}>
              <Ionicons name="sparkles" size={13} color="#FFFFFF" />
            </View>
            <Text style={styles.eyebrow}>COIN OVERVIEW</Text>
          </View>

          <View style={styles.titleSparkRow}>
            <Text style={styles.pageTitle}>Wallet</Text>
            <Ionicons name="sparkles" size={19} color="#F05A28" style={styles.titleSparkIcon} />
          </View>
          <Text style={styles.subtitle}>Every skill swap, all in one place.</Text>
          <View style={styles.titleAccentBar} />
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color="#F05A28" />
            <Text style={styles.stateText}>Loading your wallet...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={32} color="#B84E38" />
            <Text style={styles.stateTitle}>We couldn’t load your wallet</Text>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Cinema Ticket-Stub Balance Card */}
            <View style={styles.ticketBalanceCard}>
              <Ionicons
                name="film-outline"
                size={92}
                color="rgba(255, 248, 234, 0.07)"
                style={styles.ticketWatermarkReel}
              />
              <Ionicons
                name="sparkles"
                size={20}
                color="rgba(246, 214, 140, 0.4)"
                style={styles.ticketSparkle}
              />

              {/* Perforated Ticket Edge Notches */}
              <View style={[styles.ticketEdgeNotch, styles.notchTopLeft]} />
              <View style={[styles.ticketEdgeNotch, styles.notchMidLeft]} />
              <View style={[styles.ticketEdgeNotch, styles.notchBotLeft]} />
              <View style={[styles.ticketEdgeNotch, styles.notchTopRight]} />
              <View style={[styles.ticketEdgeNotch, styles.notchMidRight]} />
              <View style={[styles.ticketEdgeNotch, styles.notchBotRight]} />

              <View style={styles.balanceCardTop}>
                <View style={styles.balanceLabelRow}>
                  <Ionicons name="ticket-outline" size={14} color="#F6D68C" />
                  <Text style={styles.balanceLabel}>AVAILABLE TO SPEND</Text>
                </View>
                <View style={styles.coinBadge}>
                  <Image
                    source={require('../../assets/headerIcon/coin.png')}
                    style={styles.balanceCoinIcon}
                    resizeMode="contain"
                  />
                </View>
              </View>

              <View style={styles.balanceLine}>
                <Text style={styles.balanceAmount}>{profile?.coin_balance ?? 0}</Text>
                <Text style={styles.balanceUnit}>coins</Text>
              </View>

              {/* Dashed Ticket Tear Divider */}
              <View style={styles.dashedDivider} />

              <View style={styles.balanceFooter}>
                <Ionicons name="checkmark-circle" size={15} color="#F2AC3C" />
                <Text style={styles.balanceNote}>Ready to book your next session</Text>
              </View>
            </View>

            {/* Elevated Pending Coins Card */}
            <View style={styles.pendingCard}>
              <View style={styles.pendingLeft}>
                <View style={styles.pendingIconCircle}>
                  <Ionicons name="hourglass-outline" size={20} color="#8A5B1D" />
                </View>
                <View style={styles.pendingCopy}>
                  <View style={styles.pendingTitleRow}>
                    <Text style={styles.pendingTitle}>Pending coins</Text>
                    <View style={styles.pendingTag}>
                      <Ionicons name="time-outline" size={10} color="#8A5B1D" />
                      <Text style={styles.pendingTagText}>IN REVIEW</Text>
                    </View>
                  </View>
                  <View style={styles.pendingAmountRow}>
                    <Text style={styles.pendingAmount}>{pendingTotal}</Text>
                    <Text style={styles.pendingUnit}>coins</Text>
                  </View>
                  <Text style={styles.pendingDescription}>
                    from {pendingTransactions.length} session
                    {pendingTransactions.length !== 1 ? 's' : ''} awaiting confirmation
                  </Text>
                </View>
              </View>
            </View>

            {/* Section Subheader matching Sessions */}
            <View style={styles.historyHeader}>
              <View style={styles.historyTitleRow}>
                <View style={styles.sectionIconTile}>
                  <Ionicons name="receipt-outline" size={17} color="#152822" />
                </View>
                <View>
                  <Text style={styles.historyTitle}>Transaction history</Text>
                  <Text style={styles.historySubtitle}>Your recent coin activity</Text>
                </View>
              </View>
              <View style={styles.periodPill}>
                <Ionicons name="flash" size={10} color="#245748" />
                <Text style={styles.periodLabel}>LATEST</Text>
              </View>
            </View>

            {/* Pill Filters with Icons */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersContainer}
            >
              {transactionFilters.map((filter) => {
                const isSelected = activeFilter === filter.key;
                return (
                  <TouchableOpacity
                    key={filter.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setActiveFilter(filter.key)}
                    style={[styles.filterPill, isSelected && styles.filterPillSelected]}
                  >
                    <Ionicons
                      name={isSelected ? filter.activeIcon : filter.icon}
                      size={15}
                      color={isSelected ? '#FFFFFF' : '#29483F'}
                    />
                    <Text style={[styles.filterText, isSelected && styles.filterTextSelected]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Transactions Card List */}
            <View style={styles.transactionListCard}>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((transaction, index) => {
                  const isEarned = transaction.type === 'Earned';
                  const isPending = transaction.type === 'Pending';

                  return (
                    <View
                      key={transaction.id}
                      style={[
                        styles.transactionRow,
                        index === filteredTransactions.length - 1 && styles.lastTransactionRow,
                      ]}
                    >
                      <View
                        style={[
                          styles.transactionMark,
                          isEarned
                            ? styles.earnedMark
                            : isPending
                            ? styles.pendingMark
                            : styles.spentMark,
                        ]}
                      >
                        <Ionicons
                          name={
                            isEarned
                              ? 'arrow-down-circle'
                              : isPending
                              ? 'hourglass-outline'
                              : 'arrow-up-circle'
                          }
                          size={20}
                          color={isEarned ? '#245748' : isPending ? '#9A6B1E' : '#B84E38'}
                        />
                      </View>

                      <View style={styles.transactionInfo}>
                        <Text style={styles.transactionTitle} numberOfLines={1}>
                          {transaction.description}
                        </Text>
                        <View style={styles.dateRow}>
                          <Ionicons name="calendar-outline" size={11} color="#8D958E" />
                          <Text style={styles.transactionDate}>
                            {formatTransactionDate(transaction.created_at)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.transactionAmountBlock}>
                        <Text
                          style={[
                            styles.transactionAmount,
                            isEarned
                              ? styles.earnedAmount
                              : isPending
                              ? styles.pendingAmountText
                              : styles.spentAmount,
                          ]}
                        >
                          {transaction.type === 'Spent' ? '-' : '+'}
                          {transaction.amount}
                        </Text>
                        <View
                          style={[
                            styles.statusMiniBadge,
                            isEarned
                              ? styles.earnedBadge
                              : isPending
                              ? styles.pendingBadge
                              : styles.spentBadge,
                          ]}
                        >
                          <Text
                            style={[
                              styles.transactionStatus,
                              isEarned
                                ? styles.earnedAmount
                                : isPending
                                ? styles.pendingAmountText
                                : styles.spentAmount,
                            ]}
                          >
                            {transaction.type.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="wallet-outline" size={34} color="#9BA8A0" />
                  <Text style={styles.emptyTitle}>No transactions here yet</Text>
                  <Text style={styles.emptyDescription}>
                    {activeFilter === 'All'
                      ? 'New coin activity will appear in this list.'
                      : `No ${activeFilter.toLowerCase()} transactions found.`}
                  </Text>
                </View>
              )}
            </View>
          </>
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
    minWidth: 62,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: 128,
  },

  /* Hero Header matching Sessions & Profile */
  heroHeader: {
    marginBottom: 16,
    position: 'relative',
  },
  headerWatermark: {
    position: 'absolute',
    right: 6,
    top: -4,
    transform: [{ rotate: '12deg' }],
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
    fontSize: 30,
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
    width: 64,
    height: 3,
    backgroundColor: '#F29F38',
    borderRadius: 2,
    marginTop: 8,
  },

  /* Ticket-Stub Balance Card */
  ticketBalanceCard: {
    overflow: 'hidden',
    backgroundColor: '#214E41',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 22,
    marginBottom: 12,
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
    right: 12,
    top: 12,
    transform: [{ rotate: '15deg' }],
  },
  ticketSparkle: {
    position: 'absolute',
    right: 68,
    top: 24,
  },
  ticketEdgeNotch: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FDF6EC',
  },
  notchTopLeft: { left: -7, top: 24 },
  notchMidLeft: { left: -7, top: '52%', marginTop: -7 },
  notchBotLeft: { left: -7, bottom: 24 },
  notchTopRight: { right: -7, top: 24 },
  notchMidRight: { right: -7, top: '52%', marginTop: -7 },
  notchBotRight: { right: -7, bottom: 24 },

  balanceCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceLabel: {
    color: '#D9EAE3',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  coinBadge: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8EA',
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#F2AC3C',
  },
  balanceCoinIcon: {
    width: 24,
    height: 30,
  },
  balanceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  balanceUnit: {
    color: '#F6D68C',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  dashedDivider: {
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(196, 216, 203, 0.35)',
    borderStyle: 'dashed',
    marginTop: 14,
    marginBottom: 12,
  },
  balanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceNote: {
    color: '#DCE8DB',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Elevated Pending Card */
  pendingCard: {
    backgroundColor: '#FFFCF8',
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderRadius: 16,
    padding: 15,
    marginBottom: 22,
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pendingLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pendingIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FDE8C8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pendingCopy: {
    flex: 1,
  },
  pendingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingTitle: {
    color: '#152822',
    fontSize: 15,
    fontWeight: '800',
  },
  pendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDE8C8',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingTagText: {
    color: '#8A5B1D',
    fontSize: 9,
    fontWeight: '800',
  },
  pendingAmountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  pendingAmount: {
    color: '#8A5B1D',
    fontSize: 25,
    fontWeight: '900',
  },
  pendingUnit: {
    color: '#66766B',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 5,
  },
  pendingDescription: {
    color: '#7C8178',
    fontSize: 12,
    marginTop: 2,
  },

  /* Section Header */
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  historyTitleRow: {
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
  historyTitle: {
    color: '#152822',
    fontSize: 18,
    fontWeight: '900',
  },
  historySubtitle: {
    color: '#6C7A72',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DDEBD9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  periodLabel: {
    color: '#245748',
    fontSize: 10,
    fontWeight: '800',
  },

  /* Pill Filters */
  filtersContainer: {
    gap: 8,
    paddingBottom: 14,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFCF8',
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterPillSelected: {
    backgroundColor: '#F05A28',
    borderColor: '#F05A28',
    shadowColor: '#F05A28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  filterText: {
    color: '#29483F',
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  /* Transaction Card List */
  transactionListCard: {
    backgroundColor: '#FFFCF8',
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderRadius: 18,
    paddingHorizontal: 14,
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2EAE0',
  },
  lastTransactionRow: {
    borderBottomWidth: 0,
  },
  transactionMark: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    marginRight: 12,
  },
  earnedMark: {
    backgroundColor: '#DCECD9',
  },
  pendingMark: {
    backgroundColor: '#FDE8C8',
  },
  spentMark: {
    backgroundColor: '#FADBD4',
  },
  transactionInfo: {
    flex: 1,
    minWidth: 0,
  },
  transactionTitle: {
    color: '#152822',
    fontSize: 14,
    fontWeight: '800',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  transactionDate: {
    color: '#8D958E',
    fontSize: 11,
    fontWeight: '500',
  },
  transactionAmountBlock: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '900',
  },
  earnedAmount: {
    color: '#245748',
  },
  pendingAmountText: {
    color: '#8A5B1D',
  },
  spentAmount: {
    color: '#B84E38',
  },
  statusMiniBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  earnedBadge: {
    backgroundColor: '#DCECD9',
  },
  pendingBadge: {
    backgroundColor: '#FDE8C8',
  },
  spentBadge: {
    backgroundColor: '#FADBD4',
  },
  transactionStatus: {
    fontSize: 9,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyTitle: {
    color: '#152822',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
  emptyDescription: {
    color: '#7C8178',
    fontSize: 12,
    marginTop: 4,
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