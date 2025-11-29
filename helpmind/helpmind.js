const GOOGLE_MAPS_API_KEY = "AIzaSyA7JqjZb4lw2H3Cl3tfJMmVHvRr-RhtAVI";

let map;
let service;
let directionsService;
let directionsRenderer;
let autocomplete;
let markers = [];
let userPosition = null;

// ==============================
//  Inicialização do mapa
// ==============================
function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: -23.55, lng: -46.63 },
    zoom: 13,
  });

  service = new google.maps.places.PlacesService(map);
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);

  setupAutocomplete();
  getUserLocation();
}

// ==============================
//  Autocomplete
// ==============================
function setupAutocomplete() {
  const input = document.getElementById("city-input");
  autocomplete = new google.maps.places.Autocomplete(input, {
    types: ["(cities)"],
    componentRestrictions: { country: "br" },
  });
}

// ==============================
//  Localização do usuário
// ==============================
function getUserLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        map.setCenter(userPosition);

        new google.maps.Marker({
          map,
          position: userPosition,
          title: "Sua localização",
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
          },
        });
      },
      () => console.warn("Não foi possível pegar sua localização.")
    );
  }
}

// ==============================
//  Pesquisa de instituições
// ==============================
document.getElementById("search-button").addEventListener("click", async () => {
  const locationText = document.getElementById("city-input").value.trim();
  const serviceType = document.getElementById("service-select").value;
  const ratingMin = document.getElementById("rating-filter").value;
  const radius = parseInt(document.getElementById("distance-filter").value);
  const openNow = document.getElementById("open-now-filter").checked;

  let searchLocation = null;

  // ===========================
  // 1. Usar localização atual se o campo estiver vazio
  // ===========================
  if (!locationText) {
    if (userPosition) {
      searchLocation = userPosition;
    } else {
      alert("Aguardando sua localização. Tente novamente em alguns segundos.");
      return;
    }
  }

  // ===========================
  // 2. Se a cidade foi digitada, usar geocode
  // ===========================
  if (locationText) {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        locationText
      )}&key=${GOOGLE_MAPS_API_KEY}`
    );

    const data = await res.json();

    if (!data.results.length) {
      alert("Cidade não encontrada.");
      return;
    }

    searchLocation = data.results[0].geometry.location;
  }

  // Centraliza o mapa
  map.setCenter(searchLocation);

  // ===========================
  // 3. Tipo de serviço
  // ===========================
  let query = "";
  switch (serviceType) {
    case "hospitais psiquiatricos":
      query = "hospital psiquiátrico";
      break;
    case "clinicas saude mental":
      query = "clínica psicologia psicoterapia";
      break;
    case "caps":
      query = "centro de atenção psicossocial CAPS";
      break;
    case "emergencia psicologica":
      query = "emergência psicológica 24h";
      break;
    default:
      query = "psicólogo psicoterapia saúde mental";
  }

  // ===========================
  // 4. Requisição Places
  // ===========================
  const request = {
    location: searchLocation,
    radius,
    query,
    openNow,
  };

  service.textSearch(request, (results, status) => {
    clearMarkers();
    const list = document.getElementById("institutions-list");
    list.innerHTML = "";

    if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
      list.innerHTML = "<p>Nenhuma instituição encontrada.</p>";
      return;
    }

    // Filtro por nota
    const filtered = results.filter(
      (r) => !ratingMin || (r.rating || 0) >= parseFloat(ratingMin)
    );

    filtered.forEach((place) => {
      const marker = new google.maps.Marker({
        map,
        position: place.geometry.location,
        title: place.name,
      });

      markers.push(marker);

      const div = document.createElement("div");
      div.className = "institution";
      div.innerHTML = `
        <h3>${place.name}</h3>
        <p>${place.formatted_address}</p>
        <p><strong>Nota:</strong> ${place.rating || "N/A"} ⭐</p>
        <button class="route-btn" data-lat="${place.geometry.location.lat()}" data-lng="${place.geometry.location.lng()}">
          Traçar rota
        </button>
      `;

      list.appendChild(div);
    });

    enableRouteButtons();
    document.querySelector(".results").classList.remove("hidden");
  });
});

// ==============================
//  Rotas
// ==============================
function enableRouteButtons() {
  document.querySelectorAll(".route-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);

      if (!userPosition) {
        alert("Localização atual indisponível.");
        return;
      }

      directionsService.route(
        {
          origin: userPosition,
          destination: { lat, lng },
          travelMode: "DRIVING",
        },
        (result, status) => {
          if (status === "OK") {
            directionsRenderer.setDirections(result);
          }
        }
      );
    });
  });
}

// ==============================
//  Limpar marcadores
// ==============================
function clearMarkers() {
  markers.forEach((m) => m.setMap(null));
  markers = [];
}
