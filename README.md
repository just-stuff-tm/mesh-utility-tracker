# 📡 Mesh Utility Tracker

<p align="center">
  Progressive Web App for mapping <b>MeshCore LoRa</b> coverage  
  with optional cloud ingestion.
</p>

<p align="center">
  <a href="https://production.mesh-utility-tracker.pages.dev/"><b>🌐 Live App</b></a>
</p>

---

## 💬 Community & Support

<p align="center">
  <a href="https://discord.gg/Xyhjz7CtuW">
    <img src="https://img.shields.io/badge/Discord-Join%20Server-5865F2?logo=discord&logoColor=white" />
  </a>
  &nbsp;&nbsp;
  <a href="https://www.buymeacoffee.com/Just_Stuff_TM">
    <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-FFDD00?logo=buymeacoffee&logoColor=black" />
  </a>
</p>

---

## 🚀 Features

- 📡 Real-time coverage map and node discovery  
- 🔵 Web Bluetooth integration for MeshCore devices  
- 📴 Offline-first storage and map usage  
- ☁️ Optional Cloudflare Worker ingestion  
- 🔒 Built-in privacy controls & deletion request flow  

---

## 🛠 Tech Stack

**Frontend**
- React 18  
- TypeScript  
- Vite  
- Tailwind CSS  
- Leaflet  
- Wouter  

**Optional Backend**
- Cloudflare Workers  
- D1  
- Durable Objects  
- GitHub API  

---

## 🗂 Project Structure

```text
src/        Frontend app  
worker/     Cloudflare Worker backend  
shared/     Shared utilities and schema  
public/     Static assets  
```

---

## 🔐 Data & Privacy

- Data sharing is **opt-in**  
- Dead zones remain local and are not uploaded  
- [Public mesh data repository:](https://github.com/just-stuff-tm/mesh-data) 
- Deletion requests can be initiated from Settings  

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and development details.

---

## 📄 License

This project is licensed under the MIT License — see [LICENSE](./LICENSE).
