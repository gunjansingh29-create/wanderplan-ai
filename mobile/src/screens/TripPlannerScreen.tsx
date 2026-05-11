/**
 * TripPlannerScreen – AI-powered trip planning chat
 *
 * Provides an interactive AI chat interface matching the LLM flow
 * in WanderPlanLLMFlow.jsx. The user describes their ideal trip and
 * the assistant builds an itinerary step by step.
 */
import React, {useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import {Colors, Radii, Shadows, Spacing, Typography} from '../constants/theme';
import {sendPlannerMessage, PlannerMessage} from '../services/api';

// ---------------------------------------------------------------------------
// Suggested prompts shown when chat is empty
// ---------------------------------------------------------------------------
const SUGGESTIONS = [
  '🇯🇵  10 days in Japan for two – cherry blossom season',
  '🇮🇹  Amalfi Coast road trip, 7 days, €4 000 budget',
  '🏄  Solo backpacking SE Asia for 3 weeks',
  '🏔  Family ski holiday in Colorado, 5 people',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Message extends PlannerMessage {
  id: string;
  streaming?: boolean;
}

export default function TripPlannerScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({animated: true}), 80);
  }, []);

  async function sendMessage(text: string) {
    if (!text.trim() || thinking) return;
    setInput('');

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text.trim(),
    };

    setMessages(prev => [...prev, userMsg]);
    scrollToEnd();

    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    };
    setMessages(prev => [...prev, assistantMsg]);
    setThinking(true);

    try {
      const history: PlannerMessage[] = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      await sendPlannerMessage(history, chunk => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? {...m, content: m.content + chunk}
              : m,
          ),
        );
        scrollToEnd();
      });
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  "I'm having trouble connecting to the server right now. Please check your connection and try again.",
                streaming: false,
              }
            : m,
        ),
      );
    } finally {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId ? {...m, streaming: false} : m,
        ),
      );
      setThinking(false);
      scrollToEnd();
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={90}>

        {/* Message list */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            messages.length === 0 ? (
              <EmptyState onSuggestion={sendMessage} />
            ) : null
          }
          renderItem={({item}) => <MessageBubble message={item} />}
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Describe your dream trip…"
            placeholderTextColor={Colors.text3}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || thinking) && styles.sendBtnDisabled,
            ]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || thinking}
            activeOpacity={0.8}>
            {thinking ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.sendIcon}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({onSuggestion}: {onSuggestion: (t: string) => void}) {
  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.icon}>🌍</Text>
      <Text style={emptyStyles.title}>Your AI Travel Planner</Text>
      <Text style={emptyStyles.body}>
        Tell me about your dream trip and I'll build a personalised itinerary,
        find flights, suggest stays and activities – all in one place.
      </Text>
      <Text style={emptyStyles.suggestLabel}>Try asking…</Text>
      {SUGGESTIONS.map(s => (
        <TouchableOpacity
          key={s}
          style={emptyStyles.chip}
          onPress={() => onSuggestion(s)}
          activeOpacity={0.75}>
          <Text style={emptyStyles.chipText}>{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MessageBubble({message}: {message: Message}) {
  const isUser = message.role === 'user';
  return (
    <View
      style={[
        bubbleStyles.row,
        isUser ? bubbleStyles.rowUser : bubbleStyles.rowAssistant,
      ]}>
      {!isUser && (
        <View style={bubbleStyles.avatar}>
          <Text style={bubbleStyles.avatarText}>✈️</Text>
        </View>
      )}
      <View
        style={[
          bubbleStyles.bubble,
          isUser ? bubbleStyles.bubbleUser : bubbleStyles.bubbleAssistant,
        ]}>
        <Text
          style={[
            bubbleStyles.text,
            isUser && bubbleStyles.textUser,
          ]}>
          {message.content}
          {message.streaming && !message.content && (
            <Text style={bubbleStyles.cursor}>▍</Text>
          )}
        </Text>
        {message.streaming && message.content && (
          <Text style={bubbleStyles.cursor}>▍</Text>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: Colors.bg},
  flex: {flex: 1},
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    flexGrow: 1,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: Typography.base,
    color: Colors.text,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.text3,
  },
  sendIcon: {
    color: Colors.white,
    fontSize: 18,
    marginLeft: 2,
  },
});

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  icon: {fontSize: 56, marginBottom: Spacing.md},
  title: {
    fontSize: Typography.xl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  body: {
    fontSize: Typography.sm,
    color: Colors.text2,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  suggestLabel: {
    fontSize: Typography.sm,
    fontWeight: '700',
    color: Colors.text,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  chipText: {
    fontSize: Typography.sm,
    color: Colors.text,
  },
});

const bubbleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    alignItems: 'flex-end',
  },
  rowUser: {justifyContent: 'flex-end'},
  rowAssistant: {justifyContent: 'flex-start'},
  avatar: {
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  avatarText: {fontSize: 16},
  bubble: {
    maxWidth: '80%',
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    ...Shadows.sm,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: Typography.base,
    color: Colors.text,
    lineHeight: 22,
  },
  textUser: {
    color: Colors.white,
  },
  cursor: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
