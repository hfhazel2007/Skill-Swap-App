import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import Navigation from './navbar';

interface DBMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface DBConversation {
  id: number;
  user1_id: number;
  user2_id: number;
  last_message: string | null;
  last_message_at: string | null;
  partner_name: string;
  partner_id: number;
  partner_initials: string;
  unread_count: number;
}

const avatarThemes = [
  { bg: '#DCECD9', border: '#B9D6B4', text: '#1E463A', tint: 'rgba(181, 214, 194, 0.25)' },
  { bg: '#FDE8C8', border: '#F5CD93', text: '#7A4D14', tint: 'rgba(247, 197, 136, 0.24)' },
  { bg: '#FADBD4', border: '#F0B6A8', text: '#8C321E', tint: 'rgba(240, 150, 130, 0.20)' },
];

export default function MessagesScreen() {
  const { conversation, question, userId, targetUserId } = useLocalSearchParams<{
    conversation?: string;
    question?: string;
    userId?: string;
    targetUserId?: string;
  }>();

  const rawId = Array.isArray(userId) ? userId[0] : userId;
  const currentUserId = rawId && rawId !== 'undefined' ? parseInt(rawId, 10) : 1001;

  const initialConversation = Array.isArray(conversation) ? conversation[0] : conversation;
  const initialQuestion = Array.isArray(question) ? question[0] : question;
  const rawTargetId = Array.isArray(targetUserId) ? targetUserId[0] : targetUserId;
  const partnerUserId = rawTargetId && rawTargetId !== 'undefined' ? parseInt(rawTargetId, 10) : null;

  const [conversations, setConversations] = useState<DBConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<DBConversation | null>(null);
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [draft, setDraft] = useState(initialQuestion || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [coinBalance, setCoinBalance] = useState<number>(0);

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // 1. Fetch conversations & auto-open room if targetUserId/conversation param is present
  useEffect(() => {
    async function fetchInitialData() {
      try {
        setLoadingConversations(true);

        const { data: userData } = await supabase
          .from('users')
          .select('coin_balance')
          .eq('id', currentUserId)
          .maybeSingle();

        if (userData) {
          setCoinBalance(userData.coin_balance ?? 0);
        }

        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
          .order('last_message_at', { ascending: false });

        if (convError) throw convError;

        let roomList = convData || [];

        // Dynamic room creation if targetUserId is passed from Sessions screen
        if (partnerUserId && partnerUserId !== currentUserId) {
          const u1 = Math.min(currentUserId, partnerUserId);
          const u2 = Math.max(currentUserId, partnerUserId);

          const existingRoom = roomList.find((c) => c.user1_id === u1 && c.user2_id === u2);

          if (!existingRoom) {
            const { data: newRoom, error: createError } = await supabase
              .from('conversations')
              .insert({ user1_id: u1, user2_id: u2 })
              .select('*')
              .single();

            if (!createError && newRoom) {
              roomList = [newRoom, ...roomList];
            }
          }
        }

        // Fetch partner user names
        const partnerIds = Array.from(
          new Set(roomList.map((c) => (c.user1_id === currentUserId ? c.user2_id : c.user1_id)))
        );

        let usersMap = new Map<number, string>();
        if (partnerIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, full_name')
            .in('id', partnerIds);

          usersMap = new Map((usersData || []).map((u) => [u.id, u.full_name]));
        }

        const formattedConversations: DBConversation[] = roomList.map((c) => {
          const pId = c.user1_id === currentUserId ? c.user2_id : c.user1_id;
          const pName = usersMap.get(pId) || initialConversation || `User ${pId}`;
          const initials = pName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);

          return {
            id: c.id,
            user1_id: c.user1_id,
            user2_id: c.user2_id,
            last_message: c.last_message,
            last_message_at: c.last_message_at,
            partner_name: pName,
            partner_id: pId,
            partner_initials: initials,
            unread_count: 0,
          };
        });

        setConversations(formattedConversations);

        // Auto-open chat box
        if (partnerUserId) {
          const matched = formattedConversations.find((c) => c.partner_id === partnerUserId);
          if (matched) {
            setActiveConversation(matched);
            setIsChatOpen(true);
          }
        } else if (initialConversation) {
          const matched = formattedConversations.find(
            (c) => c.partner_name.toLowerCase() === initialConversation.toLowerCase()
          );
          if (matched) {
            setActiveConversation(matched);
            setIsChatOpen(true);
          }
        }
      } catch (err) {
        console.error('Error fetching conversations:', err);
      } finally {
        setLoadingConversations(false);
      }
    }

    fetchInitialData();
  }, [userId, targetUserId, conversation]);

  // 2. Fetch Messages and subscribe to Realtime updates
  useEffect(() => {
    if (!activeConversation) return;

    async function loadMessages() {
      try {
        setLoadingMessages(true);
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', activeConversation.id)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    }

    loadMessages();

    const channel = supabase
      .channel(`chat_${activeConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as DBMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation]);

  const openConversation = (conv: DBConversation) => {
    setActiveConversation(conv);
    setIsChatOpen(true);
  };

  const handleSendMessage = async () => {
    const text = draft.trim();
    if (!text || !activeConversation || sending) return;

    try {
      setSending(true);

      const { data: insertedMsg, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation.id,
          sender_id: currentUserId,
          receiver_id: activeConversation.partner_id,
          content: text,
        })
        .select()
        .single();

      if (msgError) throw msgError;

      await supabase
        .from('conversations')
        .update({
          last_message: text,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', activeConversation.id);

      if (insertedMsg) {
        setMessages((prev) => [...prev, insertedMsg]);
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? { ...c, last_message: text, last_message_at: new Date().toISOString() }
            : c
        )
      );

      setDraft('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filteredConversations = conversations.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.partner_name.toLowerCase().includes(q) ||
      (item.last_message || '').toLowerCase().includes(q)
    );
  });

  // ==========================================
  // ACTIVE CHAT BOX VIEW
  // ==========================================
  if (isChatOpen && activeConversation) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {/* Chat Top Bar */}
        <View style={styles.chatTopBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to messages"
            onPress={() => setIsChatOpen(false)}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={22} color="#152822" />
          </Pressable>

          <View style={styles.chatAvatar}>
            <Text style={styles.chatAvatarText}>{activeConversation.partner_initials}</Text>
            <View style={styles.onlineDotSmall} />
          </View>

          <View style={styles.chatIdentity}>
            <Text style={styles.chatName} numberOfLines={1}>
              {activeConversation.partner_name}
            </Text>
            <View style={styles.chatSubRow}>
              <Ionicons name="sparkles" size={11} color="#F05A28" />
              <Text style={styles.chatTopic}>SkillSwap Partner</Text>
            </View>
          </View>

          <View style={styles.chatHeaderBadge}>
            <Image
              source={require('../../assets/headerIcon/message.png')}
              style={styles.chatIcon}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Subtle Background Watermark */}
        <Ionicons
          name="chatbubbles-outline"
          size={130}
          color="rgba(36, 87, 72, 0.04)"
          style={styles.chatRoomWatermark}
        />

        {loadingMessages ? (
          <ActivityIndicator size="large" color="#F05A28" style={{ flex: 1, justifyContent: 'center' }} />
        ) : (
          <ScrollView
            ref={scrollViewRef}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            style={styles.messageList}
            contentContainerStyle={styles.messageContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Editorial Ticket Banner at Top of Chat */}
            <View style={styles.chatIntroBanner}>
              <View style={styles.chatIntroIconCircle}>
                <Ionicons name="swap-horizontal" size={16} color="#245748" />
              </View>
              <Text style={styles.chatIntroText}>
                Coordinate your session details, links, and prep notes with{' '}
                <Text style={{ fontWeight: '800', color: '#152822' }}>
                  {activeConversation.partner_name.split(' ')[0]}
                </Text>
                .
              </Text>
            </View>

            {messages.length > 0 ? (
              messages.map((message) => {
                const isMine = message.sender_id === currentUserId;
                return (
                  <View key={message.id} style={[styles.messageRow, isMine && styles.myMessageRow]}>
                    <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
                      <Text style={[styles.messageText, isMine && styles.myMessageText]}>
                        {message.content}
                      </Text>
                      <View style={[styles.bubbleMetaRow, isMine && styles.myBubbleMetaRow]}>
                        <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>
                          {formatTime(message.created_at)}
                        </Text>
                        {isMine && (
                          <Ionicons
                            name="checkmark-done"
                            size={13}
                            color="#F6D68C"
                            style={{ marginLeft: 4 }}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyChatBox}>
                <Ionicons name="hand-left-outline" size={32} color="#F05A28" />
                <Text style={styles.emptyChatTitle}>Say hello!</Text>
                <Text style={styles.emptyChatSubtitle}>
                  Start the conversation with {activeConversation.partner_name.split(' ')[0]}.
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Message Composer */}
        <View style={styles.composer}>
          <View style={styles.inputWrapper}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#8D958E" />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              style={styles.input}
              placeholder={`Message ${activeConversation.partner_name.split(' ')[0]}...`}
              placeholderTextColor="#9A9C94"
              multiline
              maxLength={500}
              accessibilityLabel="Message"
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={handleSendMessage}
            style={[styles.sendButton, (!draft.trim() || sending) && styles.disabledSendButton]}
            disabled={!draft.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.sendText}>Send</Text>
                <Ionicons name="send" size={13} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ==========================================
  // INBOX THREAD LIST VIEW
  // ==========================================
  return (
    <View style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/headerIcon/skillSwap.png')}
          style={styles.logoIcon}
          resizeMode="contain"
          accessibilityLabel="SkillSwap"
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
        style={styles.inbox}
        contentContainerStyle={styles.inboxContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial Hero Header matching Sessions, Profile & Wallet */}
        <View style={styles.heroHeader}>
          <Ionicons
            name="chatbubbles-outline"
            size={68}
            color="rgba(240, 90, 40, 0.08)"
            style={styles.headerWatermark}
          />
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowIconBadge}>
              <Ionicons name="chatbubble-ellipses" size={13} color="#FFFFFF" />
            </View>
            <Text style={styles.eyebrow}>DIRECT MESSAGES</Text>
          </View>

          <View style={styles.titleSparkRow}>
            <Text style={styles.pageTitle}>Messages</Text>
            <Ionicons name="sparkles" size={19} color="#F05A28" style={styles.titleSparkIcon} />
          </View>
          <Text style={styles.subtitle}>Keep in touch with your session partners.</Text>
          <View style={styles.titleAccentBar} />
        </View>

        {/* Search / Filter Bar */}
        <View style={styles.searchBarCard}>
          <Ionicons name="search-outline" size={18} color="#6C7A72" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search partners or messages..."
            placeholderTextColor="#9A9C94"
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9A9C94" />
            </Pressable>
          )}
        </View>

        {/* Section Subheader */}
        <View style={styles.listHeader}>
          <View style={styles.listTitleRow}>
            <View style={styles.sectionIconTile}>
              <Ionicons name="people-outline" size={17} color="#152822" />
            </View>
            <View>
              <Text style={styles.listTitle}>Recent chats</Text>
              <Text style={styles.listCount}>
                {filteredConversations.length} active thread
                {filteredConversations.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>LIVE</Text>
          </View>
        </View>

        {/* Ticket-Style Conversation Cards */}
        {loadingConversations ? (
          <ActivityIndicator size="large" color="#F05A28" style={{ marginTop: 40 }} />
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map((item, index) => {
            const theme = avatarThemes[index % avatarThemes.length];
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Open conversation with ${item.partner_name}`}
                onPress={() => openConversation(item)}
                style={({ pressed }) => [styles.threadCard, pressed && styles.threadCardPressed]}
              >
                {/* Subtle Corner Tint & Watermark */}
                <View style={[styles.cardCornerTint, { backgroundColor: theme.tint }]} />
                <Ionicons
                  name="film-outline"
                  size={42}
                  color="rgba(36, 87, 72, 0.06)"
                  style={styles.cardWatermarkIcon}
                />

                {/* Ticket Left/Right Side Notches */}
                <View style={[styles.ticketNotch, styles.ticketNotchLeft]} />
                <View style={[styles.ticketNotch, styles.ticketNotchRight]} />

                {/* Partner Avatar Badge */}
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: theme.bg, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.initials, { color: theme.text }]}>
                    {item.partner_initials}
                  </Text>
                  <View style={styles.onlineIndicator} />
                </View>

                <View style={styles.ticketDivider} />

                {/* Thread Copy & Action */}
                <View style={styles.threadCopy}>
                  <View style={styles.threadTopRow}>
                    <Text style={styles.threadName} numberOfLines={1}>
                      {item.partner_name}
                    </Text>
                    <View style={styles.timeBadge}>
                      <Ionicons name="time-outline" size={11} color="#6C7A72" />
                      <Text style={styles.threadTime}>
                        {formatTime(item.last_message_at) || 'New'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.previewRow}>
                    <Ionicons name="chatbubble-outline" size={13} color="#70776F" />
                    <Text style={styles.threadPreview} numberOfLines={1}>
                      {item.last_message || 'Tap to start your conversation'}
                    </Text>
                  </View>

                  <View style={styles.threadFooterRow}>
                    <View style={styles.partnerTag}>
                      <Ionicons name="school-outline" size={11} color="#245748" />
                      <Text style={styles.partnerTagText}>SWAP PARTNER</Text>
                    </View>

                    <View style={styles.openChatPill}>
                      <Text style={styles.openChatText}>Open chat</Text>
                      <Ionicons name="chevron-forward" size={12} color="#F05A28" />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="chatbubbles-outline" size={32} color="#F05A28" />
            </View>
            <Text style={styles.emptyTitle}>No recent chats</Text>
            <Text style={styles.emptySubtitle}>
              Your ongoing conversations with session partners will appear here.
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

  inbox: { flex: 1 },
  inboxContent: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 124 },

  /* Editorial Hero Header */
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

  /* Search Bar Card */
  searchBarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFCF8',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#EADCCE',
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    color: '#152822',
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 2,
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
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DDEBD9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#245748',
  },
  livePillText: {
    color: '#245748',
    fontSize: 10,
    fontWeight: '800',
  },

  /* Ticket-Style Thread Card */
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFCF8',
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  threadCardPressed: {
    backgroundColor: '#F7EFE4',
  },
  cardCornerTint: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  cardWatermarkIcon: {
    position: 'absolute',
    right: 10,
    bottom: 6,
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

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  initials: {
    fontSize: 16,
    fontWeight: '900',
  },
  onlineIndicator: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2E8B57',
    borderWidth: 2,
    borderColor: '#FFFCF8',
  },
  ticketDivider: {
    width: 1,
    height: 52,
    backgroundColor: '#E8C4B0',
    marginHorizontal: 12,
  },
  threadCopy: {
    flex: 1,
    minWidth: 0,
  },
  threadTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  threadName: {
    flex: 1,
    color: '#152822',
    fontSize: 16,
    fontWeight: '900',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F3ECE0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  threadTime: {
    color: '#6C7A72',
    fontSize: 10,
    fontWeight: '700',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  threadPreview: {
    flex: 1,
    color: '#526159',
    fontSize: 13,
    fontWeight: '500',
  },
  threadFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  partnerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCECD9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  partnerTagText: {
    color: '#245748',
    fontSize: 9,
    fontWeight: '800',
  },
  openChatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FDF8F1',
    borderWidth: 1,
    borderColor: '#E3D5C3',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  openChatText: {
    color: '#F05A28',
    fontSize: 10,
    fontWeight: '800',
  },

  /* Empty Inbox State */
  emptyStateCard: {
    padding: 36,
    alignItems: 'center',
    backgroundColor: '#FFFCF8',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EADCCE',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FDE8DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#152822',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#7C8178',
    textAlign: 'center',
    marginTop: 4,
  },

  /* ==========================================
     CHAT ROOM STYLES
     ========================================== */
  chatTopBar: {
    minHeight: 84,
    paddingTop: 22,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFCF6',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE6D8',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4EDE2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  chatAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FADBD4',
    borderWidth: 1.5,
    borderColor: '#F0B6A8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative',
  },
  chatAvatarText: {
    color: '#8C321E',
    fontSize: 15,
    fontWeight: '900',
  },
  onlineDotSmall: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#2E8B57',
    borderWidth: 2,
    borderColor: '#FFFCF6',
  },
  chatIdentity: { flex: 1 },
  chatName: {
    color: '#152822',
    fontSize: 16,
    fontWeight: '900',
  },
  chatSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  chatTopic: {
    color: '#6C7A72',
    fontSize: 11,
    fontWeight: '600',
  },
  chatHeaderBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F9F1E4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EADCCE',
  },
  chatIcon: { width: 22, height: 22 },
  chatRoomWatermark: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
  },
  messageList: { flex: 1 },
  messageContent: { padding: 18, paddingBottom: 16 },
  chatIntroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFCF8',
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
  },
  chatIntroIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCECD9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatIntroText: {
    flex: 1,
    color: '#526159',
    fontSize: 12,
    lineHeight: 17,
  },
  messageRow: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  myMessageRow: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: '#152822',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  theirBubble: {
    backgroundColor: '#FFFCF8',
    borderWidth: 1,
    borderColor: '#EADCCE',
    borderBottomLeftRadius: 4,
  },
  myBubble: {
    backgroundColor: '#214E41',
    borderBottomRightRadius: 4,
  },
  messageText: {
    color: '#152822',
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  bubbleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  myBubbleMetaRow: {
    justifyContent: 'flex-end',
  },
  messageTime: {
    color: '#8D958E',
    fontSize: 10,
    fontWeight: '600',
  },
  myMessageTime: {
    color: '#C5D8C4',
  },
  emptyChatBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyChatTitle: {
    color: '#152822',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  emptyChatSubtitle: {
    color: '#7C8178',
    fontSize: 13,
    marginTop: 4,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#EFE6D8',
    backgroundColor: '#FFFCF6',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    maxHeight: 90,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: '#FDF6EC',
    borderWidth: 1,
    borderColor: '#EADCCE',
  },
  input: {
    flex: 1,
    color: '#152822',
    fontSize: 14,
    paddingVertical: 0,
  },
  sendButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#F05A28',
    shadowColor: '#F05A28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  disabledSendButton: {
    backgroundColor: '#D9D4CA',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});