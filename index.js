// Firebaseの初期化
import {
  auth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup
} from "./firebase.js";

// --------------------------------------
// UI制御：ボタンの有効/無効
// --------------------------------------
function setButtonsDisabled(disabled) {
  document.getElementById("loginBtn").disabled = disabled;
  document.getElementById("googleBtn").disabled = disabled;
  document.getElementById("appleBtn").disabled = disabled;
  document.getElementById("msBtn").disabled = disabled;
}

// --------------------------------------
// ステータスメッセージ表示
// --------------------------------------
function setStatusMessage(msg) {
  document.getElementById("statusMsg").textContent = msg;
}

// --------------------------------------
// ログイン前に localStorage をクリア
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
    setStatusMessage("ユーザー情報取得中…");

    const user = auth.currentUser;
    if (!user) {
      alert("ログイン状態が確認できません");
      setButtonsDisabled(false);
      return;
    }

    const idToken = await user.getIdToken(true);

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
      setButtonsDisabled(false);
      return;
    }

    // localStorage に保存
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
    setButtonsDisabled(false);
  }
}

// --------------------------------------
// メールアドレス + パスワード
// --------------------------------------
document.getElementById("loginBtn").addEventListener("click", () => {
  clearUserInfo();
  setButtonsDisabled(true);
  setStatusMessage("ログイン処理中…");

  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;

  signInWithEmailAndPassword(auth, email, pass)
    .then(afterLogin)
    .catch((error) => {
      document.getElementById("errorMsg").textContent =
        "ログイン失敗：" + error.message;
      setButtonsDisabled(false);
      setStatusMessage("");
    });
});

// --------------------------------------
// Google ログイン
// --------------------------------------
document.getElementById("googleBtn").addEventListener("click", () => {
  clearUserInfo();
  setButtonsDisabled(true);
  setStatusMessage("Google ログイン処理中…");

  const provider = new GoogleAuthProvider();

  signInWithPopup(auth, provider)
    .then(afterLogin)
    .catch((error) => {
      document.getElementById("errorMsg").textContent =
        "Google ログイン失敗：" + error.message;
      setButtonsDisabled(false);
      setStatusMessage("");
    });
});

// --------------------------------------
// Apple ログイン
// --------------------------------------
document.getElementById("appleBtn").addEventListener("click", () => {
  clearUserInfo();
  setButtonsDisabled(true);
  setStatusMessage("Apple ログイン処理中…");

  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");

  signInWithPopup(auth, provider)
    .then(afterLogin)
    .catch((error) => {
      document.getElementById("errorMsg").textContent =
        "Apple ログイン失敗：" + error.message;
      setButtonsDisabled(false);
      setStatusMessage("");
    });
});

// --------------------------------------
// Microsoft ログイン
// --------------------------------------
document.getElementById("msBtn").addEventListener("click", () => {
  clearUserInfo();
  setButtonsDisabled(true);
  setStatusMessage("Microsoft ログイン処理中…");

  const provider = new OAuthProvider("microsoft.com");
  provider.setCustomParameters({ prompt: "select_account" });

  signInWithPopup(auth, provider)
    .then(afterLogin)
    .catch((error) => {
      document.getElementById("errorMsg").textContent =
        "Microsoft ログイン失敗：" + error.message;
      setButtonsDisabled(false);
      setStatusMessage("");
    });
});