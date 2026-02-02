// ChildMap.map.js
//
// Google Maps 専用モジュール
// Vue 本体（ChildMap.js）で ...MapMethods として取り込む

const MapMethods = {
  /**
   * VisitStatus による通常マーカー
   */
  getMarkerIcon(status) {
    const colors = {
      "在宅": "green",
      "不在": "yellow",
      "NG": "red",
      "保留": "gray",
    };

    const color = colors[status] || "gray";

    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 0.9,
      strokeColor: "white",
      strokeWeight: 1,
      scale: 8,
    };
  },

  /**
   * 地図モーダルを開く
   */
  openMapModal(house) {
    const lat = parseFloat(house.CSVLat || this.childInfo.CSVLat || 34.6937);
    const lng = parseFloat(house.CSVLng || this.childInfo.CSVLng || 135.5023);
    const kmlUrl = this.childInfo.KMLURL;

    $('#mapModal').modal('show');

    this.$nextTick(() => {
      const mapEl = document.getElementById("mapModalContainer");
      if (!mapEl || !window.google) return;

      this.map = new google.maps.Map(mapEl, {
        center: { lat, lng },
        zoom: 18,
      });

      this.infoWindow = new google.maps.InfoWindow();
      this.activeMarker = null;

      // KML レイヤー
      if (kmlUrl) {
        this.kmlLayer = new google.maps.KmlLayer({
          url: kmlUrl,
          map: this.map,
          preserveViewport: false,
        });

        google.maps.event.addListener(this.kmlLayer, "defaultviewport_changed", () => {
          const bounds = this.kmlLayer.getDefaultViewport();
          if (bounds) {
            this.map.fitBounds(bounds);
          }
        });
      }

      // ★ 初期選択住戸を保存（idle 後に赤ピン適用するため）
      this._initialCenterHouse = house;

      // idle 時にマーカー生成 → その後に赤ピン適用
      google.maps.event.addListener(this.map, "idle", () => {
        this.updateVisibleHouses();

        if (this._initialCenterHouse) {
          const target = this.markers.find(
            m => m.houseData.ID === this._initialCenterHouse.ID
          );
          if (target) {
            this.highlightMarker(target);
          }
          this._initialCenterHouse = null;
        }
      });
    });
  },

  /**
   * 地図範囲内の住戸だけマーカー表示（赤ピン対応）
   */
  updateVisibleHouses() {
    if (!this.map) return;

    const bounds = this.map.getBounds();
    if (!bounds) return;

    // 既存マーカー削除
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];

    this.houses.forEach(house => {
      const lat = parseFloat(house.CSVLat);
      const lng = parseFloat(house.CSVLng);
      if (isNaN(lat) || isNaN(lng)) return;

      const pos = new google.maps.LatLng(lat, lng);

      if (bounds.contains(pos)) {
        const marker = new google.maps.Marker({
          position: pos,
          map: this.map,
          icon: this.getMarkerIcon(house.VisitStatus),
          title: house.Address || "",
        });

        marker.houseData = house;

        marker.addListener("click", () => {
          this.highlightMarker(marker);
        });

        this.markers.push(marker);
      }
    });

    // すでに赤ピンがある場合は復元
    if (this.activeMarker) {
      const target = this.markers.find(
        m => m.houseData.ID === this.activeMarker.houseData.ID
      );
      if (target) {
        this.highlightMarker(target);
      }
    }
  },

  /**
   * マーカーを赤ピンにして吹き出し表示
   * 吹き出しクリック → 一覧へスクロール
   */
  highlightMarker(marker) {
    // すでに赤ピンがあれば元の色に戻す
    if (this.activeMarker && this.activeMarker !== marker) {
      const hPrev = this.activeMarker.houseData;
      this.activeMarker.setIcon(this.getMarkerIcon(hPrev.VisitStatus));
    }

    // 赤ピン化
    marker.setIcon("http://maps.google.com/mapfiles/ms/icons/red-dot.png");
    this.activeMarker = marker;

    const h = marker.houseData;

    const content = `
      <div id="infowindow-content" style="font-size:14px; cursor:pointer;">
        <strong>${h.FamilyName || '世帯名なし'}</strong><br>
        ${h.Address || ''}
        <div style="margin-top:4px; font-size:12px; color:#007bff;">
          → この住戸へ移動
        </div>
      </div>
    `;

    this.infoWindow.setContent(content);
    this.infoWindow.open(this.map, marker);

    // ★ InfoWindow の DOM が生成されたタイミングでクリックイベントを付与
    google.maps.event.addListenerOnce(this.infoWindow, "domready", () => {
      const el = document.getElementById("infowindow-content");
      if (el) {
        el.addEventListener("click", () => {
          // Vue の scrollToHouse を呼ぶ
          this.scrollToHouse(h.ID);
        });
      }
    });
  },
};