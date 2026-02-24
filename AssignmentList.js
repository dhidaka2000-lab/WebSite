const { createApp, ref, onMounted, computed } = Vue;

createApp({
  setup() {
    const screenWidth = ref(window.innerWidth);
    const cardsNumbers = ref(0);
    const childs = ref([]);
    const userMaster = ref([]);
    const selectedChild = ref(null);
    const modalInstance = ref(null);

    const userEmail = ref("");
    const userName = ref("");
    const userGroup = ref("");
    const userrole = ref(0);

    const filterMode = ref("all");

    // ★ COLOR → HTML カラーコード変換
    const colorMap = {
      "赤": "#CC0000",
      "青": "#0066CC",
      "黄": "#FFD700",
      "白": "#999999",
      "緑": "#00AA55",
      "★": "#FFD700",
      "": "white"
    };

    const statusClass = (child) => {
      switch (child.CHILDSTATUS) {
        case "貸出中": return "bg-warning text-black";
        case "返却済": return "bg-info text-white";
        case "貸出可能": return "bg-success text-white";
        default: return "bg-secondary text-white";
      }
    };

    const getUserName = (id) => {
      if (!id) return "-";
      const u = userMaster.value.find(x => String(x.ID) === String(id));
      return u ? `${u.UserName}${u.BS || ""}` : "-";
    };

    const logout = () => {
      firebase.auth().signOut().then(() => {
        window.location.href = "index.html";
      });
    };

    const go = (page) => {
      window.location.href = page + ".html";
    };

    const goToMap = (child) => {
      const url = `./ChildMap.html?cardNo=${child.CARDNO}&childNo=${child.CHILDNO}&loginUser=${userEmail.value}`;
      window.location.href = url;
    };

    // ★ Firebase ログイン状態監視
    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      userEmail.value = localStorage.getItem("loginUserEmail") ?? "";
      userName.value = localStorage.getItem("loginUserName") ?? "";
      userGroup.value = localStorage.getItem("loginUserGroup") ?? "";
      userrole.value = Number(localStorage.getItem("loginUserRole") ?? 0);

      fetchChildCards();
    });

    // ★ モーダルを開く
    const openModal = (type, child) => {
      selectedChild.value = child;

      if (!modalInstance.value) {
        modalInstance.value = new bootstrap.Modal(
          document.getElementById("childModal")
        );
      }

      modalInstance.value.show();

      // ★ モーダルが完全に開いた後に地図を描画
      const modalEl = document.getElementById("childModal");
      modalEl.addEventListener("shown.bs.modal", () => {
        initModalMap(child);
      }, { once: true });
    };

    const closeModal = () => {
      modalInstance.value?.hide();
    };

    // ★ Google Map 初期化
    const initModalMap = (child) => {
      if (!child.CHILDLAT || !child.CHILDLNG) return;

      const pos = {
        lat: Number(child.CHILDLAT),
        lng: Number(child.CHILDLNG)
      };

      const mapEl = document.getElementById("modalMap");
      mapEl.innerHTML = ""; // 再描画バグ防止

      const map = new google.maps.Map(mapEl, {
        center: pos,
        zoom: 17,
        mapTypeControl: false
      });

      new google.maps.Marker({
        position: pos,
        map,
        title: child.CHILDBLOCK
      });

      // ★ モーダル内の地図は resize が必須
      setTimeout(() => {
        google.maps.event.trigger(map, "resize");
        map.setCenter(pos);
      }, 200);
    };

    const handleResize = () => {
      screenWidth.value = window.innerWidth;
    };

    const isUpdating = ref(false);
    let toastInstance = null;

    // ★ キャッシュ対応
    const fetchChildCards = async () => {
      const CACHE_KEY = "childCardCache";
      const CACHE_EXPIRE = 18000 * 60 * 1000;

      const cache = localStorage.getItem(CACHE_KEY);
      if (cache) {
        const parsed = JSON.parse(cache);
        if (Date.now() - parsed.timestamp < CACHE_EXPIRE) {
          childs.value = parsed.items;
          cardsNumbers.value = parsed.items.length;

          document.getElementById("loading").style.display = "none";

          fetchFromWorker(false);
          return;
        }
      }

      fetchFromWorker(true);
    };

    // ★ Worker → Supabase
    const fetchFromWorker = async (hideLoading) => {
      try {
        const user = firebase.auth().currentUser;
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

        if (data.status === "success") {
          childs.value = data.cards;
          userMaster.value = data.userMaster || [];
          cardsNumbers.value = data.cards.length;

          localStorage.setItem("childCardCache", JSON.stringify({
            timestamp: Date.now(),
            items: data.cards
          }));
        }
      } catch (error) {
        console.error("Worker/Supabase API の取得に失敗:", error);
      }

      if (hideLoading) {
        document.getElementById("loading").style.display = "none";
      }
    };

    // ★ 最新情報に更新
    const refresh = () => {
      if (isUpdating.value) return;

      isUpdating.value = true;
      document.getElementById("loading").style.display = "flex";

      fetchFromWorker(true).then(() => {
        isUpdating.value = false;

        if (!toastInstance) {
          const toastEl = document.getElementById("updateToast");
          toastInstance = new bootstrap.Toast(toastEl);
        }
        toastInstance.show();
      });
    };

    // ★ フィルタロジック
    const filteredChilds = computed(() => {
      if (filterMode.value === "all") return childs.value;
      if (filterMode.value === "lent") return childs.value.filter(c => c.CHILDSTATUS === "貸出中");
      if (filterMode.value === "focus") return childs.value.filter(c => c.COLOR === "★");
      if (filterMode.value === "nonfocus") return childs.value.filter(c => c.COLOR !== "★");
      return childs.value;
    });

    // ★ セッション管理
    let sessionTimer = null;
    const SESSION_LIMIT = 18000 * 1000;

    const resetSessionTimer = () => {
      if (sessionTimer) clearTimeout(sessionTimer);
      sessionTimer = setTimeout(() => {
        alert("一定時間操作がなかったためログアウトしました。");
        logout();
      }, SESSION_LIMIT);
    };

    window.addEventListener("click", resetSessionTimer);
    window.addEventListener("keydown", resetSessionTimer);
    window.addEventListener("touchstart", resetSessionTimer);

    onMounted(() => {
      window.addEventListener("resize", handleResize);
      resetSessionTimer();
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
      getUserName,
      colorMap,
      openModal,
      closeModal,
      goToMap,
      logout,
      go,
      refresh,
      isUpdating,
      filterMode,
      filteredChilds
    };
  }
}).mount("#app");