// Firebaseの初期化
import {
  auth,
  onAuthStateChanged,
  signOut
} from "./firebase.js";


// ログイン状態の監視
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("userInfo").textContent =
      `ログイン中：${user.email}`;
  } else {
    // 未ログインならログイン画面へ
    window.location.href = "index.html";
  }
});

// ログアウト
document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "index.html";
  });
});