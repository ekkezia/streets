// "use client";

// import { useRouter } from "next/navigation";
// import React from "react";
// import ReactDOM from "react-dom/client"; // Import ReactDOM at the top of your file
// import Globe from "react-globe.gl";

// const TRACKS = {
//   jkt: {
//     href: "/jakarta",
//     lat: 0.7893,
//     lng: 113.9213,
//     size: 20,
//     color: "white",
//     label: "Jakarta",
//     key: "jkt",
//   },
//   hkg: {
//     href: "/hong-kong",
//     lat: 35.8617,
//     lng: 104.1954,
//     size: 20,
//     color: "white",
//     label: "Hong Kong",
//     key: "hkg",
//   },
// };

// const markerSvg = `<svg viewBox="-4 0 36 36">
// <path fill="currentColor" d="M14,0 C21.732,0 28,5.641 28,12.6 C28,23.963 14,36 14,36 C14,36 0,24.064 0,12.6 C0,5.641 6.268,0 14,0 Z"></path>
// <circle fill="black" cx="14" cy="14" r="7"></circle>
// </svg>`;

// // Convert to array
// const gData = Object.keys(TRACKS).map((trackKey) => ({
//   href: TRACKS[trackKey].href,
//   lat: TRACKS[trackKey].lat,
//   lng: TRACKS[trackKey].lng,
//   size: TRACKS[trackKey].size,
//   color: TRACKS[trackKey].color,
//   label: TRACKS[trackKey].label,
//   key: TRACKS[trackKey].key,
// }));

// const ModelGlobe = () => {
//   const router = useRouter();

//   return (
//     <div
//       style={{
//         position: "fixed",
//         top: 0,
//         left: 0,
//         zIndex: 0,
//         pointerEvents: "auto",
//       }}
//     >
//       <Globe
//         globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
//         bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
//         htmlElementsData={gData}
//         htmlElement={(d) => {
//           const el = document.createElement("div");
//           const jsxElement = (
//             <div className="label">
//               <span dangerouslySetInnerHTML={{ __html: markerSvg }} />
//               <p style={{ fontSize: 32 }}>{d.label}</p>
//             </div>
//           );

//           const root = ReactDOM.createRoot(el);
//           root.render(jsxElement);

//           el.style.color = d.color;

//           el.onclick = () => {
//             router.push(d.href);
//           };
//           return el;
//         }}
//       />
//       ,
//     </div>
//   );
// };

// export default ModelGlobe;
