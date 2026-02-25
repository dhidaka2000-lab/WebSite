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

    // -------------------------
    // ★ COLOR → HTML カラーコード変換
    // -------------------------
    const colorMap = {
      "赤": "#CC0000",
      "青": "#0066CC",
      "黄": "#FFD700",
      "白": "#999999",
      "緑": "#00AA55",
      "★": "#FFD700",
      "": "white"
    };

    // -------------------------
    // ★ Firebase 初期化（Worker 経由）
    // -------------------------
    async function initFirebase() {
      const res = await fetch("https://ekuikidev.dhidaka2000.workers.dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcName: "getFirebaseConfig" })
      });

      const data = await res.json();

      firebase.initializeApp({
        apiKey: data.apiKey,
        authDomain: "ekuikidev.firebaseapp.com",
        projectId: "ekuikidev"
      });
    }

    // -------------------------
    // ★ Google Maps API ロード（Worker 経由）
    // -------------------------
    let googleLoaded = false;

    async function loadGoogleMapsApi() {
      if (googleLoaded) return;

      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken(true);

      const res = await fetch("https://ekuikidev.dhidaka2000.workers.dev", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + idToken
        },
        body: JSON.stringify({ funcName: "getGoogleMapsUrl" })
      });

      const data = await res.json();

      await new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = data.mapUrl;
        script.onload = () => {
          googleLoaded = true;
          resolve();
        };
        document.head.appendChild(script);
      });
    }

    // -------------------------
    // ★ ステータスバッジ
    // -------------------------
    const statusClass = (child) => {
      switch (child.CHILDSTATUS) {
        case "貸出中": return "bg-warning text-black";
        case "返却済": return "bg-info text-white";
        case "貸出可能": return "bg-success text-white";
        default: return "bg-secondary text-white";
      }
    };

    // -------------------------
    // ★ userMaster → 名前変換
    // -------------------------
    const getUserName = (id) => {
      if (!id) return "-";
      const u = userMaster.value.find(x => String(x.ID) === String(id));
      return u ? `${u.UserName}${u.BS || ""}` : "-";
    };

    // -------------------------
    // ★ ログアウト
    // -------------------------
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

    // -------------------------
    // ★ Firebase Auth 監視
    // -------------------------
    async function startAuthWatcher() {
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
    }

    // -------------------------
    // ★ モーダルを開く（KML 2枚重ね対応）
    // -------------------------
    const openModal = async (type, child) => {
      selectedChild.value = child;

      await loadGoogleMapsApi();

      if (!modalInstance.value) {
        modalInstance.value = new bootstrap.Modal(
          document.getElementById("childModal")
        );
      }

      modalInstance.value.show();

      const modalEl = document.getElementById("childModal");
      modalEl.addEventListener("shown.bs.modal", () => {
        initModalMap(child);
      }, { once: true });
    };

    const closeModal = () => {
      modalInstance.value?.hide();
    };

    // -------------------------
    // ★ Google Map 初期化（親KML＋子KMLの2枚重ね）
    // -------------------------
    const initModalMap = (child) => {
      if (!child.CHILDLAT || !child.CHILDLNG) return;

      const pos = {
        lat: Number(child.CHILDLAT),
        lng: Number(child.CHILDLNG)
      };

      const mapEl = document.getElementById("modalMap");
      mapEl.innerHTML = "";

      const map = new google.maps.Map(mapEl, {
        center: pos,
        zoom: 17,
        mapTypeControl: false
      });

      // -------------------------
      // ★ 親カード KML（card_list.kml → KML）
      // -------------------------
      if (child.KML) {
        const parentKmlUrl =
          `https://ekuikidev.dhidaka2000.workers.dev?funcName=getKml&file=${encodeURIComponent(child.KML)}`;

        new google.maps.KmlLayer({
          url: parentKmlUrl,
          map: map,
          preserveViewport: true
        });
      }

      // -------------------------
      // ★ 子カード KML（child_list.kml → CHILDKML）
      // -------------------------
      if (child.CHILDKML) {
        const childKmlUrl =
          `https://ekuikidev.dhidaka2000.workers.dev?funcName=getKml&file=${encodeURIComponent(child.CHILDKML)}`;

        new google.maps.KmlLayer({
          url: childKmlUrl,
          map: map,
          preserveViewport: true
        });
      }

      // -------------------------
      // ★ ピン表示
      // -------------------------
      new google.maps.Marker({
        position: pos,
        map,
        title: child.CHILDBLOCK
      });

      setTimeout(() => {
        google.maps.event.trigger(map, "resize");
        map.setCenter(pos);
      }, 200);
    };

    // -------------------------
    // ★ キャッシュ対応
    // -------------------------
    const isUpdating = ref(false);
    let toastInstance = null;

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

    // -------------------------
    // ★ Worker → Supabase
    // -------------------------
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

          // -------------------------
          // ★ CARDNO → CHILDNO 昇順ソート
          // -------------------------
          data.cards.sort((a, b) => {
            if (a.CARDNO !== b.CARDNO) return a.CARDNO - b.CARDNO;
            return a.CHILDNO - b.CHILDNO;
          });

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

    // -------------------------
    // ★ 最新情報に更新
    // -------------------------
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

    // -------------------------
    // ★ フィルタロジック
    // -------------------------
    const filteredChilds = computed(() => {
      if (filterMode.value === "all") return childs.value;
      if (filterMode.value === "lent") return childs.value.filter(c => c.CHILDSTATUS === "貸出中");
      if (filterMode.value === "focus") return childs.value.filter(c => c.COLOR === "★");
      if (filterMode.value === "nonfocus") return childs.value.filter(c => c.COLOR !== "★");
      return childs.value;
    });

    // -------------------------
    // ★ セッション管理
    // -------------------------
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

    // -------------------------
    // ★ onMounted（初期化の順番が超重要）
    // -------------------------
    onMounted(async () => {
      await initFirebase();      // ① Firebase 初期化
      await startAuthWatcher();  // ② Auth 監視開始

      window.addEventListener("resize", () => {
        screenWidth.value = window.innerWidth;
      });

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