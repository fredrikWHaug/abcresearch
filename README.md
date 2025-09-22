# CS1060 Homework 3

Name: Fredrik Willumsen Haug
Github Handle: fredrikWHaug
Repo URL: https://github.com/cs1060f25/fredrikwhaug-hw3
Team PRD: https://drive.google.com/file/d/1yPZkodni39C78QE9jn4rkvxiRkgp_dHZ/view?usp=drivesdk



# AI Generated Readme

# ABCresearch Prototype

An AI-powered clinical trials research platform that helps biotech professionals analyze and visualize clinical trial data from ClinicalTrials.gov.

## ✨ Features

- **AI-Powered Search** - Natural language processing for intuitive clinical trial searches
- **Market Map Visualization** - Interactive visualization of clinical trial data
- **AI-Generated Insights** - Automated slide generation with key findings
- **Real-time Data** - Direct integration with ClinicalTrials.gov API
- **Responsive Design** - Works on desktop and tablet devices

## 🚀 Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Vercel Serverless Functions
- **AI**: Anthropic Claude for natural language processing
- **Authentication**: Supabase Auth
- **Deployment**: Vercel

## 🛠️ Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/abc-research-prototype.git
   cd abc-research-prototype
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ANTHROPIC_API_KEY=your-anthropic-api-key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser** at `http://localhost:5173`

## 🔍 How It Works

1. **Search** for clinical trials using natural language (e.g., "Phase 3 cancer trials by Merck")
2. **View** results in an interactive market map
3. **Generate** professional slides with AI-powered insights
4. **Export** findings for presentations and reports

## 📂 Project Structure

```
src/
├── components/         # Reusable React components
│   ├── Dashboard.tsx   # Main application view
│   └── MarketMap.tsx   # Clinical trials visualization
├── services/          # API and service integrations
│   └── clinicalTrialsAPI.ts  # ClinicalTrials.gov API client
├── contexts/          # React contexts
└── App.tsx           # Application root component
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
