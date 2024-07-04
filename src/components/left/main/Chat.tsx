import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat,
  ApiMessage,
  ApiMessageOutgoingStatus,
  ApiPeer,
  ApiTopic,
  ApiTypingStatus,
  ApiUser,
  ApiUserStatus,
} from '../../../api/types';
import type { ApiDraft } from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ChatAnimationTypes } from './hooks';
import { MAIN_THREAD_ID } from '../../../api/types';
import { StoryViewerOrigin } from '../../../types';

import { VEGA_USERS_BASE_URL } from '../../../config';
import {
  getMessageAction,
  getPrivateChatUserId,
  isUserId,
  isUserOnline,
  selectIsChatMuted,
} from '../../../global/helpers';
import { getMessageReplyInfo } from '../../../global/helpers/replies';
import {
  selectCanAnimateInterface,
  selectChat,
  selectChatMessage,
  selectCurrentMessageList,
  selectDraft,
  selectIsForumPanelClosed,
  selectIsForumPanelOpen,
  selectNotifyExceptions,
  selectNotifySettings,
  selectOutgoingStatus,
  selectTabState,
  selectThreadParam,
  selectTopicFromMessage,
  selectUser,
  selectUserStatus,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { createLocationHash } from '../../../util/routing';
import { IS_OPEN_IN_NEW_TAB_SUPPORTED } from '../../../util/windowEnvironment';

import useAppLayout from '../../../hooks/useAppLayout';
import useChatContextActions from '../../../hooks/useChatContextActions';
import useFlag from '../../../hooks/useFlag';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useSelectorSignal from '../../../hooks/useSelectorSignal';
import useShowTransition from '../../../hooks/useShowTransition';
import useChatListEntry from './hooks/useChatListEntry';

import Avatar from '../../common/Avatar';
import DeleteChatModal from '../../common/DeleteChatModal';
import FullNameTitle from '../../common/FullNameTitle';
import ReportModal from '../../common/ReportModal';
import ListItem from '../../ui/ListItem';
import ChatFolderModal from '../ChatFolderModal.async';
import MuteChatModal from '../MuteChatModal.async';
import ChatBadge from './ChatBadge';
import ChatCallStatus from './ChatCallStatus';

import './Chat.scss';

type OwnProps = {
  chatId: string;
  folderId?: number;
  orderDiff: number;
  animationType: ChatAnimationTypes;
  isPinned?: boolean;
  offsetTop: number;
  observeIntersection?: ObserveFn;
  onDragEnter?: (chatId: string) => void;
};

type StateProps = {
  chat?: ApiChat;
  isMuted?: boolean;
  user?: ApiUser;
  userStatus?: ApiUserStatus;
  actionTargetUserIds?: string[];
  actionTargetMessage?: ApiMessage;
  actionTargetChatId?: string;
  lastMessageSender?: ApiPeer;
  lastMessageOutgoingStatus?: ApiMessageOutgoingStatus;
  draft?: ApiDraft;
  isSelected?: boolean;
  isSelectedForum?: boolean;
  isForumPanelOpen?: boolean;
  canScrollDown?: boolean;
  canChangeFolder?: boolean;
  lastMessageTopic?: ApiTopic;
  typingStatus?: ApiTypingStatus;
  withInterfaceAnimations?: boolean;
};

const Chat: FC<OwnProps & StateProps> = ({
  chatId,
  folderId,
  orderDiff,
  animationType,
  isPinned,
  observeIntersection,
  chat,
  isMuted,
  user,
  userStatus,
  actionTargetUserIds,
  lastMessageSender,
  actionTargetMessage,
  actionTargetChatId,
  offsetTop,
  draft,
  withInterfaceAnimations,
  isSelected,
  isSelectedForum,
  isForumPanelOpen,
  canScrollDown,
  canChangeFolder,
  lastMessageTopic,
  typingStatus,
  onDragEnter,
}) => {
  const {
    openChat,
    focusLastMessage,
    loadTopics,
    openForumPanel,
    closeForumPanel,
  } = getActions();

  const [peer, setPeer] = useState<any>(user || chat);
  const [isLoading, setIsLoading] = useState(false);

  const { isMobile } = useAppLayout();
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isMuteModalOpen, openMuteModal, closeMuteModal] = useFlag();
  const [isChatFolderModalOpen, openChatFolderModal, closeChatFolderModal] = useFlag();
  const [isReportModalOpen, openReportModal, closeReportModal] = useFlag();
  const [shouldRenderDeleteModal, markRenderDeleteModal, unmarkRenderDeleteModal] = useFlag();
  const [shouldRenderMuteModal, markRenderMuteModal, unmarkRenderMuteModal] = useFlag();
  const [shouldRenderChatFolderModal, markRenderChatFolderModal, unmarkRenderChatFolderModal] = useFlag();
  const [shouldRenderReportModal, markRenderReportModal, unmarkRenderReportModal] = useFlag();

  const { lastMessage, isForum, isForumAsMessages } = chat || {};

  const { renderSubtitle, ref } = useChatListEntry({
    chat,
    chatId,
    lastMessage,
    typingStatus,
    draft,
    actionTargetMessage,
    actionTargetUserIds,
    actionTargetChatId,
    lastMessageTopic,
    lastMessageSender,
    observeIntersection,
    animationType,
    withInterfaceAnimations,
    orderDiff,
  });

  const getIsForumPanelClosed = useSelectorSignal(selectIsForumPanelClosed);

  const handleClick = useLastCallback(() => {
    const noForumTopicPanel = isMobile && isForumAsMessages;

    if (isForum) {
      if (isForumPanelOpen) {
        closeForumPanel(undefined, { forceOnHeavyAnimation: true });

        return;
      } else {
        if (!noForumTopicPanel) {
          openForumPanel({ chatId }, { forceOnHeavyAnimation: true });
        }

        if (!isForumAsMessages) return;
      }
    }

    openChat({ id: chatId, noForumTopicPanel, shouldReplaceHistory: true }, { forceOnHeavyAnimation: true });

    if (isSelected && canScrollDown) {
      focusLastMessage();
    }
  });

  const handleDragEnter = useLastCallback((e) => {
    e.preventDefault();
    onDragEnter?.(chatId);
  });

  const handleDelete = useLastCallback(() => {
    markRenderDeleteModal();
    openDeleteModal();
  });

  const handleMute = useLastCallback(() => {
    markRenderMuteModal();
    openMuteModal();
  });

  const handleChatFolderChange = useLastCallback(() => {
    markRenderChatFolderModal();
    openChatFolderModal();
  });

  const handleReport = useLastCallback(() => {
    markRenderReportModal();
    openReportModal();
  });

  const contextActions = useChatContextActions({
    chat,
    user,
    handleDelete,
    handleMute,
    handleChatFolderChange,
    handleReport,
    folderId,
    isPinned,
    isMuted,
    canChangeFolder,
  });

  const isIntersecting = useIsIntersecting(ref, chat ? observeIntersection : undefined);

  // Load the forum topics to display unread count badge
  useEffect(() => {
    if (isIntersecting && isForum && chat && chat.listedTopicIds === undefined) {
      loadTopics({ chatId });
    }
  }, [chat, chatId, isForum, isIntersecting]);

  const isOnline = user && userStatus && isUserOnline(user, userStatus);
  const { hasShownClass: isAvatarOnlineShown } = useShowTransition(isOnline);

  useEffect(() => {
    async function loadVegaUsername() {
      try {
        setIsLoading(true);
        // eslint-disable-next-line max-len
        const res = await fetch(`${VEGA_USERS_BASE_URL}/v1/users/phones`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ phoneNumbers: [`+${peer?.phoneNumber}`] }),
        });

        if (!res.ok) {
          // eslint-disable-next-line no-console
          console.error('Error fetching VEGA users from Phone numbers:');
        } else {
          const { users: vegaUsers } = await res.json();
          if (vegaUsers.length) {
            setPeer((p: any) => ({
              ...p,
              firstName: vegaUsers[0].username,
              lastName: '',
              profilePhoto: vegaUsers[0].profilePhoto.url,
            }));
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Network or other error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (peer?.phoneNumber) loadVegaUsername();
  }, [peer?.phoneNumber, setIsLoading]);

  if (!chat) {
    return undefined;
  }

  const className = buildClassName(
    'Chat chat-item-clickable',
    isUserId(chatId) ? 'private' : 'group',
    isForum && 'forum',
    isSelected && 'selected',
    isSelectedForum && 'selected-forum',
  );

  return (
    <ListItem
      ref={ref}
      className={className}
      href={IS_OPEN_IN_NEW_TAB_SUPPORTED ? `#${createLocationHash(chatId, 'thread', MAIN_THREAD_ID)}` : undefined}
      style={`top: ${offsetTop}px`}
      ripple={!isForum && !isMobile}
      contextActions={contextActions}
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      withPortalForMenu
    >
      <div className={buildClassName('status', 'status-clickable')}>
        <Avatar
          peer={peer}
          profilePhoto={peer.profilePhoto}
          isSavedMessages={user?.isSelf}
          withStory={!user?.isSelf}
          withStoryGap={isAvatarOnlineShown}
          storyViewerOrigin={StoryViewerOrigin.ChatList}
          storyViewerMode="single-peer"
        />
        <div className="avatar-badge-wrapper">
          <div className={buildClassName('avatar-online', isAvatarOnlineShown && 'avatar-online-shown')} />
          <ChatBadge chat={chat} isMuted={isMuted} shouldShowOnlyMostImportant forceHidden={getIsForumPanelClosed} />
        </div>
        {chat.isCallActive && chat.isCallNotEmpty && (
          <ChatCallStatus isMobile={isMobile} isSelected={isSelected} isActive={withInterfaceAnimations} />
        )}
      </div>
      <div className="info">
        <div className="info-row">
          <FullNameTitle
            isLoading={isLoading}
            peer={peer}
            withEmojiStatus
            isSavedMessages={chatId === user?.id && user?.isSelf}
            observeIntersection={observeIntersection}
          />
          {isMuted && <i className="icon icon-muted" />}
          <div className="separator" />
          {/* {chat.lastMessage && (
            <LastMessageMeta
              message={chat.lastMessage}
              outgoingStatus={lastMessageOutgoingStatus}
              draftDate={draft?.date}
            />
          )} */}
        </div>
        <div className="subtitle">
          {renderSubtitle()}
          <ChatBadge chat={chat} isPinned={isPinned} isMuted={isMuted} />
        </div>
      </div>
      {shouldRenderDeleteModal && (
        <DeleteChatModal
          isOpen={isDeleteModalOpen}
          onClose={closeDeleteModal}
          onCloseAnimationEnd={unmarkRenderDeleteModal}
          chat={chat}
        />
      )}
      {shouldRenderMuteModal && (
        <MuteChatModal
          isOpen={isMuteModalOpen}
          onClose={closeMuteModal}
          onCloseAnimationEnd={unmarkRenderMuteModal}
          chatId={chatId}
        />
      )}
      {shouldRenderChatFolderModal && (
        <ChatFolderModal
          isOpen={isChatFolderModalOpen}
          onClose={closeChatFolderModal}
          onCloseAnimationEnd={unmarkRenderChatFolderModal}
          chatId={chatId}
        />
      )}
      {shouldRenderReportModal && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={closeReportModal}
          onCloseAnimationEnd={unmarkRenderReportModal}
          peerId={chatId}
          subject="peer"
        />
      )}
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    if (!chat) {
      return {};
    }

    const { lastMessage } = chat;
    const { senderId, isOutgoing } = lastMessage || {};
    const replyToMessageId = lastMessage && getMessageReplyInfo(lastMessage)?.replyToMsgId;
    const lastMessageSender = senderId
      ? (selectUser(global, senderId) || selectChat(global, senderId)) : undefined;
    const lastMessageAction = lastMessage ? getMessageAction(lastMessage) : undefined;
    const actionTargetMessage = lastMessageAction && replyToMessageId
      ? selectChatMessage(global, chat.id, replyToMessageId)
      : undefined;
    const { targetUserIds: actionTargetUserIds, targetChatId: actionTargetChatId } = lastMessageAction || {};
    const privateChatUserId = getPrivateChatUserId(chat);
    const {
      chatId: currentChatId,
      threadId: currentThreadId,
      type: messageListType,
    } = selectCurrentMessageList(global) || {};
    const isSelected = chatId === currentChatId && currentThreadId === MAIN_THREAD_ID;
    const isSelectedForum = (chat.isForum && chatId === currentChatId)
      || chatId === selectTabState(global).forumPanelChatId;

    const user = privateChatUserId ? selectUser(global, privateChatUserId) : undefined;
    const userStatus = privateChatUserId ? selectUserStatus(global, privateChatUserId) : undefined;
    const lastMessageTopic = lastMessage && selectTopicFromMessage(global, lastMessage);

    const typingStatus = selectThreadParam(global, chatId, MAIN_THREAD_ID, 'typingStatus');

    return {
      chat,
      isMuted: selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global)),
      lastMessageSender,
      actionTargetUserIds,
      actionTargetChatId,
      actionTargetMessage,
      draft: selectDraft(global, chatId, MAIN_THREAD_ID),
      isSelected,
      isSelectedForum,
      isForumPanelOpen: selectIsForumPanelOpen(global),
      canScrollDown: isSelected && messageListType === 'thread',
      canChangeFolder: (global.chatFolders.orderedIds?.length || 0) > 1,
      ...(isOutgoing && lastMessage && {
        lastMessageOutgoingStatus: selectOutgoingStatus(global, lastMessage),
      }),
      user,
      userStatus,
      lastMessageTopic,
      typingStatus,
      withInterfaceAnimations: selectCanAnimateInterface(global),
    };
  },
)(Chat));