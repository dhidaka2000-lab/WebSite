// ==== 認証：firebase authの初期化
// firebaseコンソールから取得して貼り付け
// https://console.firebase.google.com/project/ekuikidev/settings/general/web:MGMxYWZiYjktOGYzNy00ZGEwLThhNjItNjY2YTIxYzdlNzhl?hl=ja&nonce=1768343931813
// チュートリアル（公式）
// https://www.youtube.com/watch?v=-OKrloDzGpU
// 参考ページ（qiita)
// https://qiita.com/ganyariya/items/7b58c9ba103bacadc380

// firebase.js

// Firebase App
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";

// Firebase Auth
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// ===============================
// Firebase 設定
// ===============================
export const firebaseConfig = {
  apiKey: "AIzaSyBCib4rAXfXO_6nAiEO-VutN-FytgdnuvA",
  authDomain: "ekuikidev.firebaseapp.com",
  projectId: "ekuikidev",
  storageBucket: "ekuikidev.firebasestorage.app",
  appId: "1:896828437660:web:3c3154fd640a522e0fe959"
};

// ===============================
// Firebase 初期化
// ===============================
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ===============================
// 必要な関数をまとめて export
// ===============================
export {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,   // ← Google ログイン
  OAuthProvider,        // ← Apple / Microsoft ログイン
  signInWithPopup       // ← OAuth 共通
};