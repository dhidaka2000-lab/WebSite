import { auth, onAuthStateChanged, signOut } from "./firebase.js";
const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    const screenWidth = ref(window.innerWidth);
    const cardsNumbers = ref(0);
    const childs = ref([]);
    const selectedChild = ref(null);
    const modalInstance = ref(null);

    // ログインユーザー情報
    const userEmail = ref("");
    const userName = ref("");
    const userGroup = ref("");
    const userrole = ref(0);

    // ステータス色
    const statusClass = (child) => {
      switch (child.CHILDSTATUS) {
        case "貸出中":
          return "bg-warning text-black";
        case "返却済":
          return "bg-info text-white";
        case "貸出可能":
          return "bg-success text-white";
        default:
          return "bg-secondary text-white";
      }
    };

    // ログアウト
    const logout = () => {
      signOut(auth).then(() => {
        window.location.href = "index.html";
      });
    };

    // ページ遷移
    const go = (page) => {
      window.location.href = page + ".html";
    };

    // ★★★ 子カードページへ遷移 ★★★
    const goToMap = (child) => {
      const url = `./ChildMap.html?cardNo=${child.CARDNO}&childNo=${child.CHILDNO}&loginUser=${userEmail.value}`;
      window.location.href = url;
    };

    // Firebase ログイン状態監視
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      // localStorage からユーザー情報を取得
      userEmail.value = localStorage.getItem("loginUserEmail") ?? "";
      userName.value = localStorage.getItem("loginUserName") ?? "";
      userGroup.value = localStorage.getItem("loginUserGroup") ?? "";
      userrole.value = Number(localStorage.getItem("loginUserRole") ?? 0);

      // カード情報取得
      fetchChildCards();
    });

    // モーダル
    const openModal = (type, child) => {
      selectedChild.value = child;
      if (!modalInstance.value) {
        modalInstance.value = new bootstrap.Modal(
          document.getElementById("childModal")
        );
      }
      modalInstance.value.show();
    };

    const closeModal = () => {
      modalInstance.value?.hide();
    };

    const printChildMap = (child) => {
      console.log("printChildMap:", child);
    };

    const handleResize = () => {
      screenWidth.value = window.innerWidth;
    };

    const isUpdating = ref(false);
    let toastInstance = null;

    // キャッシュ対応
    const fetchChildCards = async () => {
      const CACHE_KEY = "childCardCache";
      const CACHE_EXPIRE = 300 * 60 * 1000;

      const cache = localStorage.getItem(CACHE_KEY);
      if (cache) {
        const parsed = JSON.parse(cache);
        if (Date.now() - parsed.timestamp < CACHE_EXPIRE) {
          childs.value = parsed.items;
          cardsNumbers.value = parsed.items.length;

          document.getElementById("loading").style.display = "none";

          fetchFromGAS(false);
          return;
        }
      }

      fetchFromGAS(true);
    };

    // Worker → GAS から取得
    const fetchFromGAS = async (hideLoading) => {
      return new Promise(async (resolve) => {
        try {
          const user = auth.currentUser;
          const idToken = await user.getIdToken(true);

          const payload = {
            funcName: "getFilteredChildCardbyUser",
            userName: localStorage.getItem("loginUserName")
          };

          const response = await fetch("https://ekuikidev.dhidaka2000.workers.dev", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + idToken
            },
            body: JSON.stringify(payload)
          });

          const data = await response.json();

          if (data.status === "success" && Array.isArray(data.cards)) {
            childs.value = data.cards;
            cardsNumbers.value = data.cards.length;

            localStorage.setItem("childCardCache", JSON.stringify({
              timestamp: Date.now(),
              items: data.cards
            }));

            if (hideLoading) {
              document.getElementById("loading").style.display = "none";
            }

            resolve();
            return;
          }

        } catch (error) {
          console.error("Worker/GAS API の取得に失敗:", error);
        }

        if (hideLoading) {
          document.getElementById("loading").style.display = "none";
        }

        resolve();
      });
    };

    const refresh = () => {
      if (isUpdating.value) return;

      isUpdating.value = true;
      document.getElementById("loading").style.display = "flex";

      fetchFromGAS(true).then(() => {
        isUpdating.value = false;

        if (!toastInstance) {
          const toastEl = document.getElementById("updateToast");
          toastInstance = new bootstrap.Toast(toastEl);
        }
        toastInstance.show();
      });
    };

    onMounted(() => {
      window.addEventListener("resize", handleResize);
    });

    return {
      screenWidth,
      cardsNumbers,
      childs,
      selectedChild,
      userEmail,
      userName,
      userGroup,
      userrole,
      statusClass,
      openModal,
      closeModal,
      goToMap,     // ← 追加
      printChildMap,
      logout,
      go,
      refresh,
      isUpdating
    };
  }
}).mount("#app");