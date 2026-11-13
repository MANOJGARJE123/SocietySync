import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from './AppButton';
import AppInput from './AppInput';
import { COLORS, RADIUS, SHADOW, SPACING } from '../constants/theme';
import { ragQuery } from '../services/ragService';
import { createComplaint } from '../services/complaintService';
import { createNotice } from '../services/noticeService';
import { createMaintenance } from '../services/maintenanceService';
import { registerResident } from '../services/societyService';
import { updateProfile } from '../services/authService';
import { getErrorMessage } from '../utils/error';
import { showError } from '../utils/toast';
import { required } from '../utils/validators';
import { useResponsive } from '../hooks/useResponsive';
import { APP_EVENTS, emitAppEvent } from '../utils/appEvents';
import {
  detectAction,
  extractFields,
  getFieldPrompt,
  getNextField,
  isActionReady,
  isCancelMessage,
  isLikelyFieldValue
} from '../utils/chatIntent';

const SUGGESTIONS = ['Any maintenance due?', 'Latest notices?', 'Society rules?'];

const ChatAssistantModal = ({ visible, onClose }) => {
  const { isWeb } = useResponsive();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Hello. Ask me anything about notices, maintenance dues, or society rules.'
    }
  ]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const showSuggestions = useMemo(() => messages.length <= 1, [messages.length]);

  const appendMessage = (message) => setMessages((prev) => [...prev, message]);

  const addBotMessage = (text) => {
    appendMessage({
      id: `b-${Date.now()}`,
      sender: 'bot',
      text
    });
  };

  const inferComplaintFields = (text) => {
    const normalized = String(text || '').trim();
    if (!normalized) return {};

    const cleaned = normalized
      .replace(
        /^((please\s+)?(raise|create|file|submit)\s+(the\s+)?(a\s+)?(complaint|omplain|complain|issue|problem|grievance)\s*(about|of)?\s*)+/i,
        ''
      )
      .replace(/^(i\s+want\s+to\s+)?complain\s*(about|of)?\s*/i, '')
      .replace(/^\s*of\s+/i, '')
      .trim();

    const source = cleaned || normalized;
    const sentenceTitle = source
      .split(/[.!?]/)
      .map((item) => item.trim())
      .find(Boolean);

    return {
      title: (sentenceTitle || source || 'Complaint from chat').slice(0, 72).trim(),
      description: source.length > 8 ? source : normalized
    };
  };

  const sanitizeComplaintText = (value) =>
    String(value || '')
      .replace(
        /^((please\s+)?(raise|create|file|submit)\s+(the\s+)?(a\s+)?(complaint|omplain|complain|issue|problem|grievance)\s*(about|of)?\s*)+/i,
        ''
      )
      .replace(/^(i\s+want\s+to\s+)?complain\s*(about|of)?\s*/i, '')
      .replace(/^\s*of\s+/i, '')
      .trim();

  const executeAction = async (actionType, data) => {
    try {
      setLoading(true);
      if (actionType === 'complaint') {
        const cleanTitle = sanitizeComplaintText(data.title) || 'Complaint from chat';
        const cleanDescription = sanitizeComplaintText(data.description || data.title) || cleanTitle;
        await createComplaint({ title: cleanTitle, description: cleanDescription });
        emitAppEvent(APP_EVENTS.COMPLAINT_CREATED, { source: 'chat-modal' });
        addBotMessage('Complaint created successfully.');
        return;
      }

      if (actionType === 'notice') {
        await createNotice({
          title: data.title,
          content: data.content,
          expiryDays: data.expiryDays,
          wingId: data.wingId
        });
        addBotMessage('Notice created successfully.');
        return;
      }

      if (actionType === 'resident') {
        await registerResident({
          name: data.name,
          email: data.email,
          password: data.password,
          wingId: data.wingId,
          phone: data.phone,
          flatNumber: data.flatNumber
        });
        addBotMessage('Resident added successfully.');
        return;
      }

      if (actionType === 'maintenance') {
        await createMaintenance({
          userId: data.userId,
          month: data.month,
          amountDue: data.amountDue,
          dueDate: data.dueDate
        });
        addBotMessage('Maintenance due created successfully.');
        return;
      }

      if (actionType === 'profile') {
        await updateProfile({
          name: data.name,
          phone: data.phone,
          flatNumber: data.flatNumber
        });
        addBotMessage('Profile updated successfully.');
      }
    } catch (error) {
      showError('Chat error', getErrorMessage(error));
      addBotMessage('I could not complete that action. Please check the details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (preset) => {
    const text = (preset || question).trim();

    if (!required(text)) return;

    const userMessage = { id: `u-${Date.now()}`, sender: 'user', text };
    appendMessage(userMessage);
    setQuestion('');

    if (isCancelMessage(text)) {
      if (pendingAction) {
        setPendingAction(null);
        addBotMessage('Okay, I cancelled the request.');
        return;
      }
    }

    const parsedFields = extractFields(text);

    if (pendingAction) {
      let activeAction = pendingAction;
      const updatedData = { ...activeAction.data, ...parsedFields };
      const nextField = getNextField(activeAction.type, updatedData);

      if (!Object.keys(parsedFields).length && nextField && isLikelyFieldValue(nextField, text)) {
        updatedData[nextField] = text;
        if (activeAction.type === 'complaint' && nextField === 'description' && !updatedData.title) {
          updatedData.title = text.slice(0, 72).trim();
        }
      }

      if (!Object.keys(parsedFields).length && nextField && !isLikelyFieldValue(nextField, text)) {
        setPendingAction(null);
        activeAction = null;
      } else if (!isActionReady(activeAction.type, updatedData)) {
        setPendingAction({ type: activeAction.type, data: updatedData });
        addBotMessage(getFieldPrompt(getNextField(activeAction.type, updatedData)));
        return;
      }

      if (activeAction) {
        setPendingAction(null);
        await executeAction(activeAction.type, updatedData);
        return;
      }
    }

    const actionType = detectAction(text);
    if (actionType && actionType !== 'notice') {
      const actionData = { ...parsedFields };
      if (actionType === 'complaint') {
        const inferred = inferComplaintFields(text);
        if (!actionData.title && inferred.title) actionData.title = inferred.title;
        if (!actionData.description && inferred.description) actionData.description = inferred.description;
      }

      if (!isActionReady(actionType, actionData)) {
        setPendingAction({ type: actionType, data: actionData });
        addBotMessage(getFieldPrompt(getNextField(actionType, actionData)));
        return;
      }

      await executeAction(actionType, actionData);
      return;
    }

    try {
      setLoading(true);
      const response = await ragQuery(text);
      const botMessage = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: response?.answer || 'No answer generated.'
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      showError('Chat error', getErrorMessage(error));
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          sender: 'bot',
          text: 'I could not process your question right now. Please try again.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          style={[styles.sheet, isWeb && styles.sheetWeb]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Society Assistant</Text>
              <Text style={styles.subtitle}>Ask about notices, dues, rules</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.subText} />
            </Pressable>
          </View>

          {showSuggestions ? (
            <View style={styles.suggestionRow}>
              {SUGGESTIONS.map((item) => (
                <Pressable key={item} style={styles.suggestionChip} onPress={() => sendMessage(item)}>
                  <Text style={styles.suggestionText}>{item}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <ScrollView style={styles.chatArea} contentContainerStyle={styles.chatContent} showsVerticalScrollIndicator={false}>
            {messages.map((item) => (
              <View key={item.id} style={[styles.bubble, item.sender === 'user' ? styles.userBubble : styles.botBubble]}>
                <Text style={[styles.bubbleText, item.sender === 'user' ? styles.userText : styles.botText]}>{item.text}</Text>
              </View>
            ))}
            {loading ? (
              <View style={[styles.bubble, styles.botBubble]}>
                <Text style={styles.botText}>Typing...</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <AppInput
                value={question}
                onChangeText={setQuestion}
                placeholder="Ask your question"
                autoCapitalize="sentences"
              />
            </View>
            <AppButton
              title="Search"
              onPress={() => sendMessage()}
              loading={loading}
              fullWidth={false}
              leftIcon={<Ionicons name="search" size={18} color={COLORS.white} />}
              style={styles.searchBtn}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A66'
  },
  sheet: {
    minHeight: '72%',
    maxHeight: '88%',
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    ...SHADOW
  },
  sheetWeb: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    top: SPACING.lg,
    width: 400,
    minHeight: 'auto',
    maxHeight: 'auto',
    height: 'auto',
    borderRadius: RADIUS.lg,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#B7C9E8',
    marginBottom: SPACING.sm
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primaryDark
  },
  subtitle: {
    color: COLORS.subText,
    marginTop: 2
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceMuted
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm
  },
  suggestionChip: {
    backgroundColor: '#E7F1FF',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  suggestionText: {
    color: COLORS.secondary,
    fontWeight: '600',
    fontSize: 12
  },
  chatArea: {
    flex: 1
  },
  chatContent: {
    paddingBottom: SPACING.sm
  },
  bubble: {
    maxWidth: '84%',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF4FF'
  },
  bubbleText: {
    lineHeight: 20
  },
  userText: {
    color: '#FFFFFF'
  },
  botText: {
    color: COLORS.textPrimary
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.xs
  },
  inputWrap: {
    flex: 1
  },
  searchBtn: {
    minWidth: 110,
    marginBottom: SPACING.md
  }
});

export default ChatAssistantModal;
