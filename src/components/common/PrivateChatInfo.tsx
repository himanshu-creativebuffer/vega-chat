import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChatMember, ApiTypingStatus, ApiUser, ApiUserStatus,
} from '../../api/types';
import type { StoryViewerOrigin } from '../../types';
import type { IconName } from '../../types/icons';
import { MediaViewerOrigin } from '../../types';

import { VEGA_USERS_BASE_URL } from '../../config';
import { getMainUsername, getUserStatus, isUserOnline } from '../../global/helpers';
import { selectChatMessages, selectUser, selectUserStatus } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import RippleEffect from '../ui/RippleEffect';
import Avatar from './Avatar';
import DotAnimation from './DotAnimation';
import FullNameTitle from './FullNameTitle';
import TypingStatus from './TypingStatus';

type OwnProps = {
  userId: string;
  typingStatus?: ApiTypingStatus;
  avatarSize?: 'tiny' | 'small' | 'medium' | 'large' | 'jumbo';
  forceShowSelf?: boolean;
  status?: string;
  statusIcon?: IconName;
  ripple?: boolean;
  withDots?: boolean;
  withMediaViewer?: boolean;
  withUsername?: boolean;
  withStory?: boolean;
  withFullInfo?: boolean;
  withUpdatingStatus?: boolean;
  storyViewerOrigin?: StoryViewerOrigin;
  noEmojiStatus?: boolean;
  emojiStatusSize?: number;
  noStatusOrTyping?: boolean;
  noRtl?: boolean;
  adminMember?: ApiChatMember;
  className?: string;
  onEmojiStatusClick?: NoneToVoidFunction;
};

type StateProps =
  {
    user?: ApiUser;
    userStatus?: ApiUserStatus;
    isSavedMessages?: boolean;
    areMessagesLoaded: boolean;
  };

const PrivateChatInfo: FC<OwnProps & StateProps> = ({
  typingStatus,
  avatarSize = 'medium',
  status,
  statusIcon,
  withDots,
  withMediaViewer,
  withUsername,
  withStory,
  withFullInfo,
  withUpdatingStatus,
  emojiStatusSize,
  noStatusOrTyping,
  noEmojiStatus,
  noRtl,
  user,
  userStatus,
  isSavedMessages,
  areMessagesLoaded,
  adminMember,
  ripple,
  className,
  storyViewerOrigin,
  onEmojiStatusClick,
}) => {
  const {
    loadFullUser,
    openMediaViewer,
    loadProfilePhotos,
  } = getActions();

  const lang = useLang();

  const [userObj, setUserObj] = useState<any>(user);
  const [isLoading, setIsLoading] = useState(false);

  const { id: userId } = userObj || {};

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
          body: JSON.stringify({ phoneNumbers: [`+${userObj?.phoneNumber}`] }),
        });

        if (!res.ok) {
          // eslint-disable-next-line no-console
          console.error('Error fetching VEGA users from Phone numbers:');
        } else {
          const { users: vegaUsers } = await res.json();
          if (vegaUsers.length) {
            setUserObj((p: any) => ({
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

    if (userObj?.phoneNumber) loadVegaUsername();
  }, [userObj?.phoneNumber, setIsLoading]);

  useEffect(() => {
    if (userId) {
      if (withFullInfo) loadFullUser({ userId });
      if (withMediaViewer) loadProfilePhotos({ profileId: userId });
    }
  }, [userId, withFullInfo, withMediaViewer]);

  const handleAvatarViewerOpen = useLastCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>, hasMedia: boolean) => {
      if (userObj && hasMedia) {
        e.stopPropagation();
        openMediaViewer({
          avatarOwnerId: userObj.id,
          mediaId: 0,
          origin: avatarSize === 'jumbo' ? MediaViewerOrigin.ProfileAvatar : MediaViewerOrigin.MiddleHeaderAvatar,
        });
      }
    },
  );

  const mainUsername = useMemo(() => userObj && withUsername && getMainUsername(userObj), [userObj, withUsername]);

  if (!userObj) {
    return undefined;
  }

  function renderStatusOrTyping() {
    if (status) {
      return withDots ? (
        <DotAnimation className="status" content={status} />
      ) : (
        <span className="status" dir="auto">
          {statusIcon && <i className={`icon icon-${statusIcon} status-icon`} />}
          {renderText(status)}
        </span>
      );
    }

    if (withUpdatingStatus && !areMessagesLoaded) {
      return (
        <DotAnimation className="status" content={lang('Updating')} />
      );
    }

    if (!userObj) {
      return undefined;
    }

    if (typingStatus) {
      return <TypingStatus typingStatus={typingStatus} />;
    }

    const translatedStatus = getUserStatus(lang, userObj, userStatus);
    const mainUserNameClassName = buildClassName('handle', translatedStatus && 'withStatus');
    return (
      <span className={buildClassName('status', isUserOnline(userObj, userStatus) && 'online')}>
        {mainUsername && <span className={mainUserNameClassName}>{mainUsername}</span>}
        {translatedStatus && <span className="user-status" dir="auto">{translatedStatus}</span>}
      </span>
    );
  }

  const customTitle = adminMember
    ? adminMember.customTitle || lang(adminMember.isOwner ? 'GroupInfo.LabelOwner' : 'GroupInfo.LabelAdmin')
    : undefined;

  function renderNameTitle() {
    if (customTitle) {
      return (
        <div className="info-name-title">
          <FullNameTitle
            peer={userObj!}
            withEmojiStatus={!noEmojiStatus}
            emojiStatusSize={emojiStatusSize}
            isSavedMessages={isSavedMessages}
            onEmojiStatusClick={onEmojiStatusClick}
          />
          {customTitle && <span className="custom-title">{customTitle}</span>}
        </div>
      );
    }

    return (
      <FullNameTitle
        isLoading={isLoading}
        peer={userObj!}
        withEmojiStatus={!noEmojiStatus}
        emojiStatusSize={emojiStatusSize}
        isSavedMessages={isSavedMessages}
        onEmojiStatusClick={onEmojiStatusClick}
      />
    );
  }

  return (
    <div className={buildClassName('ChatInfo', className)} dir={!noRtl && lang.isRtl ? 'rtl' : undefined}>
      <Avatar
        profilePhoto={userObj.profilePhoto}
        key={userObj.id}
        size={avatarSize}
        peer={userObj}
        isSavedMessages={isSavedMessages}
        withStory={withStory}
        storyViewerOrigin={storyViewerOrigin}
        storyViewerMode="single-peer"
        onClick={withMediaViewer ? handleAvatarViewerOpen : undefined}
      />
      <div className="info">
        {renderNameTitle()}
        {(status || (!isSavedMessages && !noStatusOrTyping)) && renderStatusOrTyping()}
      </div>
      {ripple && <RippleEffect />}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId, forceShowSelf }): StateProps => {
    const user = selectUser(global, userId);
    const userStatus = selectUserStatus(global, userId);
    const isSavedMessages = !forceShowSelf && user && user.isSelf;
    const areMessagesLoaded = Boolean(selectChatMessages(global, userId));

    return {
      user,
      userStatus,
      isSavedMessages,
      areMessagesLoaded,
    };
  },
)(PrivateChatInfo));
