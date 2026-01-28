// Firebaseの初期化
import {
  auth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup
} from "./firebase.js";

// --------------------------------------
// ログイン前に localStorage をクリア
// （古いユーザー情報が残る事故を防ぐ）
// --------------------------------------
function clearUserInfo() {
  localStorage.removeItem("loginUserName");
  localStorage.removeItem("loginUserEmail");
  localStorage.removeItem("loginUserUID");
  localStorage.removeItem("loginUserGroup");
  localStorage.removeItem("loginUserRole");
}

// --------------------------------------
// 共通：ログイン後の処理
// --------------------------------------
async function afterLogin() {
  try {
    const user = auth.currentUser;
    if (!user) {
      alert("ログイン状態が確認できません");
      return;
    }

    const idToken = await user.getIdToken(true);

    // Worker に問い合わせ
    const response = await fetch("https://ekuikidev.dhidaka2000.workers.dev", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + idToken
      },
      body: JSON.stringify({
        funcName: "getLoginUserInformation"
      })
    });

    const data = await response.json();
    console.log("ログインユーザー情報:", data);

    if (!data || data.status !== "success") {
      alert("ユーザー情報の取得に失敗しました");
      return;
    }

    // ★★★ localStorage に保存 ★★★
    localStorage.setItem("loginUserName", data.userName ?? "");
    localStorage.setItem("loginUserEmail", data.email ?? "");
    localStorage.setItem("loginUserUID", data.uid ?? "");
    localStorage.setItem("loginUserGroup", data.group ?? "");

    if (data.role !== undefined) {
      localStorage.setItem("loginUserRole", data.role);
    }

    // メインメニューへ
    window.location.href = "mainMenu.html";

  } catch (err) {
    console.error("ログイン後のユーザー情報取得エラー:", err);
    alert("ログイン後の処理でエラーが発生しました");
  }
}

// --------------------------------------
// メールアドレス + パスワード
// --------------------------------------
document.getElementById("loginBtn").addEventListener("click", () => {
  clearUserInfo();

  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;

  signInWithEmailAndPassword(auth, email, pass)
    .then(afterLogin)
    .catch((error) => {
      document.getElementById("errorMsg").textContent =
        "ログイン失敗：" + error.message;
    });
});

// --------------------------------------
// Google ログイン
// --------------------------------------
document.getElementById("googleBtn").addEventListener("click", () => {
  clearUserInfo();

  const provider = new GoogleAuthProvider();

  signInWithPopup(auth, provider)
    .then(afterLogin)
    .catch((error) => {
      document.getElementById("errorMsg").textContent =
        "Google ログイン失敗：" + error.message;
    });
});

// --------------------------------------
// Apple ログイン
// --------------------------------------
document.getElementById("appleBtn").addEventListener("click", () => {
  clearUserInfo();

  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");

  signInWithPopup(auth, provider)
    .then(afterLogin)
    .catch((error) => {
      document.getElementById("errorMsg").textContent =
        "Apple ログイン失敗：" + error.message;
    });
});

// --------------------------------------
// Microsoft ログイン
// --------------------------------------
document.getElementById("msBtn").addEventListener("click", () => {
  clearUserInfo();

  const provider = new OAuthProvider("microsoft.com");
  provider.setCustomParameters({ prompt: "select_account" });

  signInWithPopup(auth, provider)
    .then(afterLogin)
    .catch((error) => {
      document.getElementById("errorMsg").textContent =
        "Microsoft ログイン失敗：" + error.message;
    });
});