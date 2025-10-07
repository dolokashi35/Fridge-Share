import { useMemo, useState, useEffect } from "react";
// FIX: Removed all imports related to React Router hooks (useLocation, useNavigate, HashRouter)
import axios from "axios";
// We no longer need to import the CSS file since we are using Tailwind classes.

const SAMPLE = [
  // FIX: Removing placeholder text from image URLs to prevent stretching issues.
  { id: 1, name: "Apples", category: "Produce", price: 1.99, img: "https://placehold.co/600x400/FF0000/ffffff", meta: "Purchased: Unknown", inStock: true },
  { id: 2, name: "Bananas", category: "Produce", price: 1.29, img: "https://placehold.co/600x400/FFD700/000000", meta: "Purchased: Unknown", inStock: true },
  { id: 3, name: "Blueberries", category: "Produce", price: 4.50, img: "https://placehold.co/600x400/4F46E5/ffffff", meta: "Purchased: 2 days ago", inStock: true },
  { id: 4, name: "Sourdough Bread", category: "Baked Goods", price: 5.00, img: "https://placehold.co/600x400/92400E/ffffff", meta: "Purchased: Unknown", inStock: false },
  // Adding more items for a fuller view
  { id: 5, name: "Carrots", category: "Produce", price: 0.99, img: "https://placehold.co/600x400/FF8C00/ffffff", meta: "Purchased: Unknown", inStock: true },
  { id: 6, name: "Beef Steak", category: "Meat", price: 7.99, img: "https://placehold.co/600x400/800000/ffffff", meta: "Purchased: Unknown", inStock: true },
];

const BACKEND_URL = "http://localhost:3001";
const categories = ["All", "Produce", "Meat", "Snacks", "Baked Goods"];

// RENAMED: This is the core application logic
function MarketLayout() {
  const [items, setItems] = useState([]);
  // MOCK: Replaced useLocation/useNavigate with simple variable/function definitions
  // to remove the dependency on the external router context.
  const nav = (path) => console.log(`Navigation attempted to: ${path}. Router context missing.`);

  const [term, setTerm] = useState("");
  const [cat, setCat] = useState("All");
  const [sort, setSort] = useState("name-asc");
  const [minP, setMinP] = useState(0);
  const [maxP, setMaxP] = useState(10);

  // Removed 'location' from dependencies since it's no longer used.
  useEffect(() => {
    async function fetchItems() {
      try {
        const res = await axios.get(`${BACKEND_URL}/items`);
        setItems(res.data.length ? res.data : SAMPLE);
      } catch (e) {
        setItems(SAMPLE);
      }
    }
    fetchItems();
  }, []); // Empty dependency array.

  const filtered = useMemo(() => {
    let list = items.filter((it) => {
      const okCat = cat === "All" || it.category === cat;
      const okTerm = it.name.toLowerCase().includes(term.toLowerCase());
      const okPrice = it.price >= Number(minP) && it.price <= Number(maxP);
      return okCat && okTerm && okPrice;
    });

    list.sort((a, b) => {
      switch (sort) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "price-asc": return a.price - b.price;
        case "price-desc": return b.price - a.price;
        default: return 0;
      }
    });
    return list;
  }, [items, term, cat, sort, minP, maxP]);

  // Helper component for the navigation icons
  const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
  
  const MenuIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );

  return (
    // FIX: Added 'font-inter' class for proper typography and better spacing on mobile.
    <div className="min-h-screen bg-gray-50 font-inter antialiased"> 
      {/* Top Navbar */}
      <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8 bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center space-x-4 text-gray-800 font-semibold">
          <span className="text-red-600 text-xl font-bold">M</span>
          <span className="text-xl">Market</span>
        </div>
        
        {/* Navigation Items (Orders, Alt, Profile) */}
        <div className="flex items-center space-x-6 text-gray-700 font-medium">
          <button className="flex items-center space-x-1 p-2 rounded-lg transition hover:bg-gray-100 hidden sm:flex">
             <MenuIcon className="h-5 w-5" /> 
             <span>Alt</span>
          </button>
          <span className="text-base hidden sm:inline">Orders</span>
          <div className="text-gray-600 p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition">
              <UserIcon />
          </div>
        </div>
      </div>


      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* FIX: Reduced heading size for better visual balance */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-6 text-center"> 
          Campus Grocery Marketplace
        </h1>

        {/* Filters and Sort */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {/* Search Bar */}
            <div className="relative">
                <input
                    type="search"
                    placeholder="Search..."
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:border-red-500 focus:ring-1 focus:ring-red-500 transition shadow-sm"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
            </div>
            
            {/* Sort Dropdown */}
            <div className="relative">
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-xl focus:border-red-500 focus:ring-1 focus:ring-red-500 transition shadow-sm bg-white">
                    <option value="name-asc">Name (A - Z)</option>
                    <option value="name-desc">Name (Z - A)</option>
                    <option value="price-asc">Price (Low to High)</option>
                    <option value="price-desc">Price (High to Low)</option>
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.length ? (
            filtered.map((it) => (
              <div 
                key={it.id} 
                // FIX: Ensure the max-width is controlled by the grid parent, 
                // preventing individual cards from growing too large.
                className={`bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 transition hover:shadow-xl cursor-pointer ${!it.inStock && 'opacity-60'}`} 
                // Simplified navigation logic for running outside a full routing system
                onClick={() => {console.log(`Navigating to item ${it.id}`); nav(`/items/${it.id}`) }}
              >
                {/* Image Container */}
                <div className="h-40 overflow-hidden">
                    <img 
                        src={it.img} 
                        alt={it.name} 
                        className="w-full h-full object-cover" // Ensures image fills container without stretching outside the card bounds
                        onError={(e) => { 
                            e.target.onerror = null; // prevents infinite loop 
                            e.target.src = 'https://placehold.co/600x400/CCCCCC/000000?text=Image+Error'; 
                        }}
                    />
                </div>
                
                <div className="p-4">
                  {/* FIX: Reduced product title text size */}
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{it.name}</h3>
                  <p className="text-sm font-medium text-red-500 mb-3">{it.category}</p>
                  
                  <div className="flex justify-between items-center mb-4">
                        <div>
                            <p className="text-xl font-extrabold text-gray-800">${it.price.toFixed(2)}</p>
                            {/* Using 'meta' field for Purchased date */}
                            <p className="text-xs text-gray-500">Purchased: {it.meta || "N/A"}</p>
                        </div>
                        <span className={`text-sm font-semibold ${it.inStock ? 'text-green-600' : 'text-red-600'}`}>
                            {it.inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                    </div>

                  <div className="flex space-x-3">
                    <button
                      className={`flex-1 font-bold py-2 rounded-xl transition duration-150 ${it.inStock 
                          ? 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-300' 
                          : 'bg-red-300 text-white cursor-not-allowed'}`}
                      onClick={(e) => { e.stopPropagation(); if (it.inStock) { /* Custom Modal Instead of alert */ console.log(`Requested to buy: ${it.name}`); } }}
                      disabled={!it.inStock}
                    >
                      Request
                    </button>
                    <button
                      className={`flex-1 font-bold py-2 rounded-xl transition duration-150 ${it.inStock 
                          ? 'bg-gray-800 text-white hover:bg-gray-900 shadow-md shadow-gray-300' 
                          : 'bg-gray-400 text-white cursor-not-allowed'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (it.inStock) { console.log("Messaging user"); } // Simplified nav logic
                      }}
                      disabled={!it.inStock}
                    >
                      Message
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-lg text-gray-500 text-center col-span-full py-10">No items found matching your criteria.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// FIX: Export the functional component directly to run without relying on React Router context.
export default MarketLayout;
