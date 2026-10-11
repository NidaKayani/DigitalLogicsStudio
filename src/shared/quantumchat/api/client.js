import axios from "axios";
import { getToken } from "../crypto/keyStorage";
import { getApiUrl } from "./baseUrl";

const quantumChatClient = axios.create({
  baseURL: getApiUrl(),
  timeout: 30000,
});

quantumChatClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default quantumChatClient;
