import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import PageHeader from '../components/PageHeader';
import ScreenContainer from '../components/ScreenContainer';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';
import { ragQuery } from '../services/ragService';
import { createComplaint } from '../services/complaintService';
import { createNotice } from '../services/noticeService';
import { createMaintenance } from '../services/maintenanceService';
import { registerResident } from '../services/societyService';
import { updateProfile } from '../services/authService';
import { getErrorMessage } from '../utils/error';
import { showError } from '../utils/toast';
import { required } from '../utils/validators';
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

const ChatScreen = () => {
  const { isMobile } = useResponsive();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Hello. Ask me anything about society notices, dues or rules from uploaded documents.'
    }
  ]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const handleInputKeyPress = (event) => {
    if (Platform.OS !== 'web') return;
    if (loading) return;

    const { key, shiftKey } = event?.nativeEvent || {};
    if (key === 'Enter' && !shiftKey) {
      if (typeof event?.preventDefault === 'function') {
        event.preventDefault();
      }
      sendMessage();
    }
  };

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

    const source = normalized
      // Remove repeated complaint command prefixes.
      .replace(
        /^((please\s+)?(raise|create|file|submit)\s+(the\s+)?(a\s+)?(complaint|omplain|complain|issue|problem|grievance)\s*(about|of)?\s*)+/i,
        ''
      )
      // Handles phrasing like "I want to complain about ..."
      .replace(/^(i\s+want\s+to\s+)?complain\s*(about|of)?\s*/i, '')
      .trim();

    const cleaned = source || normalized;
    const sentenceTitle = source
      .split(/[.!?]/)
      .map((item) => item.trim())
      .find(Boolean);

    return {
      title: (sentenceTitle || cleaned || 'Complaint from chat').slice(0, 72).trim(),
      description: cleaned.length > 8 ? cleaned : normalized
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
        emitAppEvent(APP_EVENTS.COMPLAINT_CREATED, { source: 'chat-screen' });
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
      const reason = getErrorMessage(error);
      showError('Chat error', reason);
      addBotMessage('I could not complete that action. Please check the details and try again.');
      addBotMessage(`Reason: ${reason}`);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (overrideText) => {
    const messageText = typeof overrideText === 'string' ? overrideText.trim() : question.trim();
    if (!required(messageText)) return;

    const userMessage = { id: `u-${Date.now()}`, sender: 'user', text: messageText };
    appendMessage(userMessage);
    setQuestion('');

    if (isCancelMessage(userMessage.text)) {
      if (pendingAction) {
        setPendingAction(null);
        addBotMessage('Okay, I cancelled the request.');
        return;
      }
    }

    const parsedFields = extractFields(userMessage.text);

    if (pendingAction) {
      let activeAction = pendingAction;
      const updatedData = { ...activeAction.data, ...parsedFields };
      const nextField = getNextField(activeAction.type, updatedData);

      if (!Object.keys(parsedFields).length && nextField && isLikelyFieldValue(nextField, userMessage.text)) {
        updatedData[nextField] = userMessage.text;
        if (activeAction.type === 'complaint' && nextField === 'description' && !updatedData.title) {
          updatedData.title = userMessage.text.slice(0, 72).trim();
        }
      }

      if (!Object.keys(parsedFields).length && nextField && !isLikelyFieldValue(nextField, userMessage.text)) {
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

    const actionType = detectAction(userMessage.text);
    if (actionType) {
      const actionData = { ...parsedFields };
      if (actionType === 'complaint') {
        const inferred = inferComplaintFields(userMessage.text);
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
      const response = await ragQuery(userMessage.text);
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
    <ScreenContainer scroll={false} contentContainerStyle={styles.screenContent}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <PageHeader
          title="RAG Assistant"
          subtitle="Ask about maintenance, society rules, and notices."
          icon="chatbubbles-outline"
        />

        <ScrollView
          style={[styles.chatArea, { flex: 1 }]}
          contentContainerStyle={[styles.chatContent, isMobile && styles.chatContentMobile]}
        >
          {messages.map((item) => (
            <View
              key={item.id}
              style={[
                styles.bubble,
                isMobile && styles.bubbleMobile,
                item.sender === 'user' ? styles.userBubble : styles.botBubble
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  isMobile && styles.bubbleTextMobile,
                  item.sender === 'user' ? styles.userText : styles.botText
                ]}
              >
                {item.text}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.inputRow, isMobile && styles.inputRowMobile]}>
          <View style={styles.inputWrap}>
            <AppInput
              value={question}
              onChangeText={(value) => {
                // Reliable Enter-to-send for multiline chat input across platforms.
                if (value.includes('\n')) {
                  const cleaned = value.replace(/\n+/g, ' ').trim();
                  setQuestion(cleaned);
                  if (!loading && required(cleaned)) {
                    sendMessage(cleaned);
                  }
                  return;
                }
                setQuestion(value);
              }}
              placeholder="Ask about maintenance, rules, notices..."
              multiline
              numberOfLines={2}
              autoCapitalize="sentences"
              onSubmitEditing={sendMessage}
              onKeyPress={handleInputKeyPress}
              returnKeyType="search"
              blurOnSubmit
            />
          </View>
          <AppButton
            title="Search"
            onPress={sendMessage}
            loading={loading}
            fullWidth={false}
            leftIcon={<Ionicons name="search" size={isMobile ? 16 : 18} color={COLORS.white} />}
            style={[styles.searchButton, isMobile && styles.searchButtonMobile]}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  screenContent: {
    flexGrow: 1
  },
  container: {
    flex: 1
  },
  chatArea: {
    flex: 1
  },
  chatContent: {
    paddingBottom: SPACING.md
  },
  chatContentMobile: {
    paddingBottom: SPACING.sm
  },
  bubble: {
    maxWidth: '84%',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm
  },
  bubbleMobile: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primaryDark
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF4FF'
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20
  },
  bubbleTextMobile: {
    fontSize: 13,
    lineHeight: 18
  },
  userText: {
    color: '#FFFFFF'
  },
  botText: {
    color: COLORS.textPrimary
  },
  inputRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm
  },
  inputRowMobile: {
    marginTop: SPACING.xs,
    gap: SPACING.xs
  },
  inputWrap: {
    flex: 1
  },
  searchButton: {
    marginBottom: SPACING.md,
    minWidth: 110
  },
  searchButtonMobile: {
    marginBottom: SPACING.sm,
    minWidth: 96
  }
});

export default ChatScreen;
