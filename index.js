// Firebaseの初期化
import { 
    auth, 
    signInWithEmailAndPassword 
} from "./firebase.js";

// イベントリスナー（ログインフォームからの送信ボタン押下待ち）
document.getElementById("loginBtn").addEventListener("click", () => {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;

    // ログイン成否の判定
    signInWithEmailAndPassword(auth, email, pass)
        .then(() => {
        window.location.href = "mainMenu.html";
        })
        .catch((error) => {
        document.getElementById("errorMsg").textContent = "ログイン失敗：" + error.message;
        });
});