import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MeetingLocationPicker.css';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Pre-defined safe zones (college campus locations)
const SAFE_ZONES = [
  { id: 'dorm-kitchen-1', name: 'McCarty Hall Kitchen', coordinates: [40.1020, -88.2272], type: 'kitchen' },
  { id: 'dorm-kitchen-2', name: 'Wassaja Hall Kitchen', coordinates: [40.1015, -88.2265], type: 'kitchen' },
  { id: 'dorm-lounge-1', name: 'Bousfield Hall Lounge', coordinates: [40.1018, -88.2268], type: 'lounge' },
  { id: 'dorm-lounge-2', name: 'Hopkins Hall Lounge', coordinates: [40.1022, -88.2275], type: 'lounge' },
  { id: 'campus-center', name: 'Student Union Food Court', coordinates: [40.1010, -88.2260], type: 'food-court' },
  { id: 'library-entrance', name: 'Main Library Entrance', coordinates: [40.1012, -88.2262], type: 'library' },
  { id: 'gym-lobby', name: 'Campus Recreation Lobby', coordinates: [40.1008, -88.2258], type: 'recreation' },
  { id: 'coffee-shop', name: 'Starbucks Campus', coordinates: [40.1005, -88.2255], type: 'coffee' }
];

// Custom marker icons for different types
const getMarkerIcon = (type) => {
  const colors = {
    kitchen: '#4CAF50',    // Green
    lounge: '#2196F3',     // Blue
    'food-court': '#FF9800', // Orange
    library: '#9C27B0',    // Purple
    recreation: '#F44336',  // Red
    coffee: '#795548',     // Brown
    custom: '#607D8B'      // Blue Grey
  };
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:${colors[type] || colors.custom};" class="safe-zone-marker"></div>`,
    iconSize: [25, 25],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

// Component to handle map interactions
function MapController({ onLocationSelect, selectedLocation, userLocation }) {
  const map = useMap();
  
  useEffect(() => {
    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng;
      onLocationSelect({
        id: 'custom',
        name: 'Custom Location',
        coordinates: [lat, lng],
        type: 'custom'
      });
    };
    
    map.on('click', handleMapClick);
    return () => map.off('click', handleMapClick);
  }, [map, onLocationSelect]);
  
  return null;
}

export default function MeetingLocationPicker({ 
  isOpen, 
  onClose, 
  onLocationConfirm, 
  userLocation,
  currentLocation = null 
}) {
  const [selectedLocation, setSelectedLocation] = useState(currentLocation);
  const [mapCenter, setMapCenter] = useState(userLocation || [40.1015, -88.2265]);
  const mapRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (userLocation) {
      setMapCenter(userLocation);
    }
  }, [userLocation]);

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
  };

  const handleUseMyLocation = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode to get actual address
          try {
            const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
            const reverseRes = await fetch(reverseUrl, {
              headers: {
                'User-Agent': 'FridgeShare/1.0'
              }
            });
            const reverseData = await reverseRes.json();
            
            // Use the display name from reverse geocoding, or fallback to formatted address
            let locationName = 'My Current Location';
            if (reverseData && reverseData.display_name) {
              // Try to get a shorter, more readable address
              const addr = reverseData.address;
              if (addr) {
                // Build a readable address from components
                const parts = [];
                if (addr.road) parts.push(addr.road);
                if (addr.house_number) parts.unshift(addr.house_number);
                if (addr.city || addr.town || addr.village) {
                  parts.push(addr.city || addr.town || addr.village);
                } else if (addr.suburb) {
                  parts.push(addr.suburb);
                }
                if (addr.state) parts.push(addr.state);
                
                locationName = parts.length > 0 
                  ? parts.join(', ') 
                  : reverseData.display_name.split(',').slice(0, 3).join(', '); // First 3 parts of full address
              } else {
                // Fallback to first part of display_name
                locationName = reverseData.display_name.split(',')[0];
              }
            }
            
            const customLocation = {
              id: 'my-location',
              name: locationName,
              coordinates: [latitude, longitude],
              type: 'custom'
            };
            setSelectedLocation(customLocation);
            setMapCenter([latitude, longitude]);
          } catch (err) {
            console.error('Reverse geocoding failed:', err);
            // Fallback to coordinates if reverse geocoding fails
            const customLocation = {
              id: 'my-location',
              name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              coordinates: [latitude, longitude],
              type: 'custom'
            };
            setSelectedLocation(customLocation);
            setMapCenter([latitude, longitude]);
          }
        },
        (err) => {
          console.error('Error getting location:', err);
          alert('Failed to get your location. Please enable location services.');
        }
      );
    }
  };

  // Debounced address search using OpenStreetMap Nominatim
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        setSearching(true);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`;
        const res = await fetch(url, {
          headers: {
            // Nominatim prefers an identifiable header; browser will include UA
          }
        });
        const data = await res.json();
        const results = (data || []).map((r) => ({
          id: r.place_id,
          name: r.display_name,
          coordinates: [parseFloat(r.lat), parseFloat(r.lon)],
          type: 'custom'
        }));
        setSearchResults(results);
      } catch (e) {
        console.error("Geocoding failed:", e);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const applySearchSelection = (loc) => {
    setSelectedLocation(loc);
    setMapCenter(loc.coordinates);
    if (mapRef.current) {
      mapRef.current.setView(loc.coordinates, 16);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationConfirm(selectedLocation);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="meeting-location-picker-overlay">
      <div className="meeting-location-picker-content">
        <div className="picker-header">
          <h3>📍 Choose Meeting Location</h3>
          <button onClick={onClose} className="close-picker-btn">&times;</button>
        </div>
        
        <div className="picker-instructions">
          <p>Tap a safe zone pin or click anywhere on the map to set a custom location.</p>
        </div>

        <div className="map-container-wrapper">
          <MapContainer
            center={mapCenter}
            zoom={16}
            whenCreated={mapInstance => { mapRef.current = mapInstance; }}
            className="meeting-map-container"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapController 
              onLocationSelect={handleLocationSelect}
              selectedLocation={selectedLocation}
              userLocation={userLocation}
            />
            
            {/* User's current location */}
            {userLocation && (
              <Marker 
                position={userLocation} 
                icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: '<div class="user-location-marker">📍</div>',
                  iconSize: [30, 30],
                  iconAnchor: [15, 15]
                })}
              >
                <Popup>Your Location</Popup>
              </Marker>
            )}
            
            {/* Safe zone markers */}
            {SAFE_ZONES.map((zone) => (
              <Marker
                key={zone.id}
                position={zone.coordinates}
                icon={getMarkerIcon(zone.type)}
                eventHandlers={{
                  click: () => handleLocationSelect(zone),
                }}
              >
                <Popup>
                  <div className="safe-zone-popup">
                    <h4>{zone.name}</h4>
                    <p className="zone-type">{zone.type.replace('-', ' ').toUpperCase()}</p>
                    <button 
                      className="select-zone-btn"
                      onClick={() => handleLocationSelect(zone)}
                    >
                      Select This Location
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
            
            {/* Selected location marker */}
            {selectedLocation && (
              <Marker
                position={selectedLocation.coordinates}
                icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: '<div class="selected-location-marker">✓</div>',
                  iconSize: [35, 35],
                  iconAnchor: [17, 17]
                })}
              >
                <Popup>
                  <div className="selected-location-popup">
                    <h4>Selected: {selectedLocation.name}</h4>
                    <p>Coordinates: {selectedLocation.coordinates[0].toFixed(4)}, {selectedLocation.coordinates[1].toFixed(4)}</p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Search box below current location area */}
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Search for a place</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Start typing an address or place name..."
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: 8
            }}
          />
          {searchQuery && (
            <div style={{ marginTop: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 180, overflowY: 'auto' }}>
              {searching ? (
                <div style={{ padding: 10, color: '#64748b' }}>Searching…</div>
              ) : searchResults.length ? (
                searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => applySearchSelection(r)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    {r.name}
                  </button>
                ))
              ) : (
                <div style={{ padding: 10, color: '#64748b' }}>No results</div>
              )}
            </div>
          )}
        </div>

        <div className="picker-actions">
          <button 
            className="use-my-location-btn"
            onClick={handleUseMyLocation}
          >
            📍 Use My Location
          </button>
          
          <div className="selected-location-info">
            {selectedLocation ? (
              <div className="location-selected">
                <span className="location-name">📍 {selectedLocation.name}</span>
                <span className="location-type">{selectedLocation.type}</span>
              </div>
            ) : (
              <div className="no-location-selected">
                No location selected
              </div>
            )}
          </div>
          
          <button 
            className="confirm-location-btn"
            onClick={handleConfirm}
            disabled={!selectedLocation}
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}
