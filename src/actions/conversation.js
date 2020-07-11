import {
  GET_CONVERSATION,
  GET_CONVERSATION_ERROR,
  GET_CONVERSATION_SUCCESS,
  SET_CONVERSATION_STATUS,
  GET_MESSAGES,
  GET_MESSAGES_SUCCESS,
  GET_MESSAGES_ERROR,
  UPDATE_CONVERSATION,
  UPDATE_MESSAGE,
  ALL_MESSAGES_LOADED,
  ALL_CONVERSATIONS_LOADED,
  SEND_MESSAGE,
  SEND_MESSAGE_SUCCESS,
  SEND_MESSAGE_ERROR,
  MARK_MESSAGES_AS_READ,
  MARK_MESSAGES_AS_READ_SUCCESS,
  MARK_MESSAGES_AS_READ_ERROR,
  SET_CONVERSATION,
  GET_CANNED_RESPONSES,
  GET_CANNED_RESPONSES_SUCCESS,
  GET_CANNED_RESPONSES_ERROR,
  SET_CONVERSATION_DETAILS,
  RESET_CONVERSATION,
  ADD_OR_UPDATE_USER_TYPING_IN_CONVERSATION,
  RESET_USER_TYPING_CONVERSATION,
  ADD_MESSAGE,
  SET_ASSIGNEE_TYPE,
  SET_CONVERSATION_META,
} from '../constants/actions';

import axios from '../helpers/APIHelper';

import { getAllNotifications } from './notification';

import { findAssigneeType, findConversationStatus } from '../helpers';

// Load all the conversations
export const getConversations = ({ assigneeType, pageNumber = 1 }) => async (
  dispatch,
  getState,
) => {
  if (pageNumber === 1) {
    dispatch({ type: GET_CONVERSATION });
  }

  const {
    conversation: { conversationStatus },
    inbox: { inboxSelected },
  } = getState();

  try {
    const inboxId = inboxSelected.id || null;

    const params = {
      inbox_id: inboxId,
      status: findConversationStatus({ conversationStatus }),
      assignee_type: findAssigneeType({ assigneeType }),
      page: pageNumber,
    };

    const response = await axios.get('conversations', {
      params,
    });

    const {
      data: { meta, payload },
    } = response.data;
    const updatedPayload = payload.sort((a, b) => {
      return b.timestamp - a.timestamp;
    });
    const allConversations = {
      meta,
      conversations: updatedPayload,
    };

    dispatch({
      type: GET_CONVERSATION_SUCCESS,
      payload: allConversations,
    });

    if (payload.length < 20) {
      dispatch({
        type: ALL_CONVERSATIONS_LOADED,
      });
    }
  } catch (error) {
    dispatch({ type: GET_CONVERSATION_ERROR, payload: error });
  }
};
// Get conversation meta info [Mainly for displaying counts]
export const getConversationsMeta = () => async (dispatch, getState) => {
  const {
    conversation: { conversationStatus, assigneeType },
    inbox: { inboxSelected },
  } = getState();

  try {
    const inboxId = inboxSelected.id || null;

    const params = {
      inbox_id: inboxId,
      status: findConversationStatus({ conversationStatus }),
      assignee_type: findAssigneeType({ assigneeType }),
    };

    const response = await axios.get('conversations/meta', {
      params,
    });

    const { meta } = response.data;
    dispatch({
      type: SET_CONVERSATION_META,
      payload: meta,
    });
  } catch (error) {}
};

// Set conversation status (Open or Resolved)
export const setConversationStatus = ({ status }) => async (dispatch) => {
  dispatch({ type: SET_CONVERSATION_STATUS, payload: status });
};

// Set conversation assignee type (Me, Unassigned, All)
export const setAssigneeType = ({ assigneeType }) => async (dispatch) => {
  dispatch({ type: SET_ASSIGNEE_TYPE, payload: assigneeType });
};

export const setConversation = ({ conversationId }) => async (dispatch) => {
  dispatch({ type: SET_CONVERSATION, payload: conversationId });
};

// Add or update new conversation to the conversation list
export const addOrUpdateConversation = ({ conversation }) => async (dispatch, getState) => {
  const {
    data: { payload },
    conversationStatus,
  } = getState().conversation;
  const { status } = conversation;
  // Add only if incoming conversation status matches currently using conversation status (open or resolved)
  if (conversationStatus === status) {
    // Check conversation is already exists or not
    const [conversationExists] = payload.filter((c) => c.id === conversation.id);
    let updatedConversations = payload;
    if (conversationExists) {
      updatedConversations = payload.filter((c) => c.id !== conversation.id);
    } else {
      updatedConversations.unshift(conversation);
    }
    dispatch({ type: UPDATE_CONVERSATION, payload: updatedConversations });
  }

  dispatch(getAllNotifications({ pageNo: 1 }));
  setTimeout(() => {
    dispatch(getConversationsMeta());
  }, 100);
};

// Add new message to a conversation
export const addMessageToConversation = ({ message }) => async (dispatch, getState) => {
  const {
    data: { payload },
    selectedConversationId,
    allMessages,
    conversationStatus,
  } = getState().conversation;

  const { conversation_id, id: messageId } = message;
  const isMessageAlreadyExist = allMessages.find((item) => item.id === messageId);

  if (selectedConversationId === conversation_id && !isMessageAlreadyExist) {
    dispatch({ type: UPDATE_MESSAGE, payload: message });
  }
  const [chat] = payload.filter((c) => c.id === message.conversation_id);
  const apiUrl = `conversations/${conversation_id}`;
  const response = await axios.get(apiUrl);
  const conversation = response.data;

  // Check conversation exist or not in conversation state
  if (!chat) {
    // Add conversation if it is not exist in conversation list
    dispatch(addOrUpdateConversation({ conversation }));
    return;
  }
  // If conversation is already exist, check the conversation status
  const { status } = conversation;

  let updatedConversations = payload;

  if (status === conversationStatus) {
    const previousMessageIds = chat.messages.map((m) => m.id);
    if (!previousMessageIds.includes(message.id)) {
      chat.messages.push(message);
    }

    const index = payload.findIndex((c) => c.id === message.conversation_id);
    updatedConversations = payload.map((content, i) => (i === index ? { ...content } : content));
    updatedConversations.unshift(...updatedConversations.splice(index, 1));
  } else {
    updatedConversations = payload.filter((c) => c.id !== conversation.id);
  }

  dispatch({ type: UPDATE_CONVERSATION, payload: updatedConversations });
  setTimeout(() => {
    dispatch(getConversationsMeta());
  }, 100);
};
// Load all the conversation messages
export const loadMessages = ({ conversationId, beforeId }) => async (dispatch) => {
  dispatch({ type: GET_MESSAGES });

  try {
    const apiUrl = `conversations/${conversationId}/messages`;

    const params = {
      before: beforeId,
    };

    const response = await axios.get(apiUrl, { params });

    const { payload } = response.data;

    dispatch({
      type: GET_MESSAGES_SUCCESS,
      payload: payload,
    });

    if (payload.length < 20) {
      dispatch({
        type: ALL_MESSAGES_LOADED,
      });
    }
  } catch (error) {
    dispatch({ type: GET_MESSAGES_ERROR, payload: error });
  }
};

export const getConversationDetails = ({ conversationId }) => async (dispatch) => {
  try {
    const apiUrl = `conversations/${conversationId}`;
    const response = await axios.get(apiUrl);
    dispatch({
      type: SET_CONVERSATION_DETAILS,
      payload: response.data,
    });
  } catch {}
};

// Send message
export const sendMessage = ({ conversationId, message }) => async (dispatch) => {
  dispatch({ type: SEND_MESSAGE });
  try {
    const apiUrl = `conversations/${conversationId}/messages`;

    const response = await axios.post(apiUrl, message);

    dispatch({
      type: SEND_MESSAGE_SUCCESS,
      payload: response.data,
    });
  } catch (error) {
    dispatch({ type: SEND_MESSAGE_ERROR, payload: error });
  }
};

export const markMessagesAsRead = ({ conversationId }) => async (dispatch, getState) => {
  const {
    data: { payload },
  } = getState().conversation;

  dispatch({ type: MARK_MESSAGES_AS_READ });
  try {
    const apiUrl = `conversations/${conversationId}/update_last_seen`;
    const agent_last_seen_at = new Date().getTime();
    const response = await axios.post(apiUrl, {
      agent_last_seen_at,
    });

    dispatch({
      type: MARK_MESSAGES_AS_READ_SUCCESS,
      payload: response.data,
    });

    const updatedConversations = payload.map((item) =>
      item.id === conversationId ? { ...item, agent_last_seen_at } : item,
    );

    dispatch({ type: UPDATE_CONVERSATION, payload: updatedConversations });
  } catch (error) {
    dispatch({ type: MARK_MESSAGES_AS_READ_ERROR, payload: error });
  }
};
export const loadCannedResponses = () => async (dispatch) => {
  dispatch({ type: GET_CANNED_RESPONSES });

  try {
    const response = await axios.get('canned_responses');

    const { data } = response;

    const payload = data.map((item) => ({
      ...item,
      title: `${item.short_code} - ${item.content.substring(0, 40)}`,
    }));

    dispatch({
      type: GET_CANNED_RESPONSES_SUCCESS,
      payload,
    });
  } catch (error) {
    dispatch({ type: GET_CANNED_RESPONSES_ERROR, payload: error });
  }
};

export const resetConversation = () => async (dispatch) => {
  dispatch({ type: RESET_CONVERSATION });
};

export const resetTypingToConversation = () => async (dispatch) => {
  dispatch({
    type: RESET_USER_TYPING_CONVERSATION,
  });
};

export const addUserTypingToConversation = ({ conversation, user }) => async (
  dispatch,
  getState,
) => {
  const { id: conversationId } = conversation;
  const { conversationTypingUsers } = await getState().conversation;
  const records = conversationTypingUsers[conversationId] || [];
  const hasUserRecordAlready = !!records.filter(
    (record) => record.id === user.id && record.type === user.type,
  ).length;
  if (!hasUserRecordAlready) {
    dispatch({
      type: ADD_OR_UPDATE_USER_TYPING_IN_CONVERSATION,
      payload: {
        conversationId,
        users: [...records, user],
      },
    });
  }
};

export const removeUserFromTypingConversation = ({ conversation, user }) => async (
  dispatch,
  getState,
) => {
  const { id: conversationId } = conversation;
  const { conversationTypingUsers } = await getState().conversation;
  const records = conversationTypingUsers[conversationId] || [];
  const updatedUsers = records.filter(
    (record) => record.id !== user.id || record.type !== user.type,
  );

  dispatch({
    type: ADD_OR_UPDATE_USER_TYPING_IN_CONVERSATION,
    payload: {
      conversationId,
      users: updatedUsers,
    },
  });
};

export const toggleTypingStatus = ({ conversationId, typingStatus }) => async (dispatch) => {
  const apiUrl = `conversations/${conversationId}/toggle_typing_status`;

  await axios
    .post(apiUrl, {
      typing_status: typingStatus,
    })
    .catch();
};

// Load initial messages [While opening chat screen from conversation list]
export const loadInitialMessage = ({ messages }) => async (dispatch) => {
  try {
    dispatch({
      type: ADD_MESSAGE,
      payload: messages,
    });
  } catch (error) {
    dispatch({ type: GET_MESSAGES_ERROR, payload: error });
  }
};

export const toggleConversationStatus = ({ conversationId }) => async (dispatch, getState) => {
  try {
    const apiUrl = `conversations/${conversationId}/toggle_status`;
    setTimeout(() => {
      dispatch(getConversationsMeta());
    }, 100);

    await axios.post(apiUrl);
    dispatch(getConversationDetails({ conversationId }));
  } catch (error) {}
};
