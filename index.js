// Firebaseの初期化（必須）
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
    localStorage.setItem("loginUserRole", data.role ?? 0);

    // メインメニューへ
    window.location.href = "mainMenu.html";

  } catch (err) {
    console.error("ログイン後のユーザー情報取得エラー:", err);
    alert("ログイン後の処理でエラーが発生しました");
    setButtonsDisabled(false);
  }
}