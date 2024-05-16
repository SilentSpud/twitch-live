type AuthMessage = { command: "login" };
type LogoutMessage = { command: "logout" };
type UserInfoMessage = { command: "getInfo" };
type UserInfo = { isLoggedIn: boolean; userName: string };
type InfoMessage = { command: "info"; data: UserInfo };
type GetStreamsMessage = { command: "getStreams" };
type StreamsMessage = { command: "streams"; data: Record<string, any>[] };
type RefreshStreamsMessage = { command: "refreshStreams" };
type GetStatusMessage = { command: "getStatus" };
type StatusMessage = { command: "status"; data: string };
export type Message = AuthMessage | LogoutMessage | UserInfoMessage | InfoMessage | GetStreamsMessage | StreamsMessage | RefreshStreamsMessage | GetStatusMessage | StatusMessage;

export type TwitchUserData = {
  user_login: string;
  user_name: string;
  game_name: string;
  type: "live";
  title: string;
  viewer_count: number;
  started_at: string;
};
export type TwitchUserResponse = {
  data: TwitchUserData[];
  pagination?: {
    cursor: string;
  };
};