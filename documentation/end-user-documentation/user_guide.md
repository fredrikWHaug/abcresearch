# ABCresearch User Guide

## Getting Started

**Application URL:** https://abcresearch.vercel.app/

**Test Credentials:**
- Email: `user@test.com`
- Password: `abcresearch`

### Logging In

When you first visit ABCresearch, you will see the login screen with three options:

1. **Sign in with existing account** - Enter your email and password
2. **Create new account** - Click "Sign Up" to register with email and password
3. **Continue as Guest** - Limited functionality without project persistence

For this guide, use the test credentials provided above.

![Login screen showing all three options](screenshots/login-screen.png)

---

## User Journey 1: Exploring a New Treatment Area

This workflow helps you rapidly assess a therapeutic area and identify promising drug candidates for further analysis.

### Step 1: Create a Research Project

After logging in, you will be directed to the projects home page.

1. Click **"Create Your First Project"**
2. Enter a descriptive project name (e.g., "GLP-1 Landscape Analysis")
3. Click **"Create"**

You will see a welcome screen with a search input labeled "Good afternoon" and several suggested queries.

![Project dashboard with search input and suggested queries](screenshots/project-search-input.png)

### Step 2: Initiate Research Search

1. Enter a search term in the input field (e.g., "GLP-1s", "obesity treatments", "semaglutide")
   - You can use drug names, disease areas, or therapeutic modalities
   - Alternatively, click one of the suggested queries

2. Click the **blue search button** to begin the search

3. Wait approximately 60 seconds while the system:
   - Queries clinical trial databases and PubMed
   - Groups results by drug compound using AI
   - Ranks drugs by volume of available data

### Step 3: Review Aggregated Results

Once processing completes, the right-side panel will populate with:

- **Drugs** - Grouped compounds with associated data
- **Clinical Trials** - Studies from ClinicalTrials.gov
- **Papers** - Research publications from PubMed
- **Press Releases** - Company announcements
- **IR Decks** - Investor relations materials

Drugs are ranked by information volume, with the most extensively documented compounds appearing first.

![Right panel showing grouped drugs and associated data](screenshots/results-panel-drugs.png)

### Step 4: Generate Asset Development Pipeline

To synthesize findings into a presentation-ready format:

1. Click the **"Asset Pipeline"** tab in the top navigation

2. Click **"AI Extract"** but reduce the count to 3 (to save time) to generate a structured table containing:
   - Drug names and sponsors
   - Development stages (Phase I/II/III, approved)
   - Key clinical endpoints
   - Competitive positioning

3. Review the generated table based on your interest

4. Click **"Download as PowerPoint"** to export a formatted presentation

You can now share this PowerPoint with your team to prioritize drugs for deeper investigation.

![Asset Pipeline table with download button](screenshots/asset-pipeline-table.png)

---

## User Journey 2: Deep Investment Analysis on a Specific Drug

This workflow demonstrates how to perform detailed analysis on a single drug candidate, including extracting data from clinical papers and monitoring real-time trial updates.

### Step 1: Set Up Project and Search

Follow Steps 1-3 from User Journey 1, using a specific drug name as your search term (e.g., "tirzepatide").

### Step 2: Locate and Download Clinical Trial Paper

1. In the right-side panel, expand the drug of interest by clicking on it

2. Navigate to the **"Papers"** section within that drug

3. Click a **PubMed link** to open the paper in a new tab

4. Download the **full-text PDF** from the publisher site
   - For this guide, you can use a tirzepatide vs. semaglutide comparison paper (located at https://drive.google.com/drive/folders/165VQhLQDty0-nvTgcClc6AQ6-YGgylnN?dmr=1&ec=wgc-drive-globalnav-goto)

![Drug expanded with Papers section visible](screenshots/results-panel-drugs.png)

### Step 3: Extract Data from PDF

1. Click the **"Data Extraction"** tab in the top navigation

2. Click **"Upload PDF"** and select your downloaded paper

3. Click **"Extract Content"** to begin processing
   - This extracts text, tables, and graphs from the PDF
   - Keep the default number of images to be analyzed for normal processing (assuming you're using the provided paper. If not, select the number of figures present in the paper you want to upload)
   - Processing takes 30-60 seconds

4. Once complete, a green card will appear under **"Extraction History"**

5. Click **"View Comprehensive Analysis"** to review:
   - Extracted markdown text
   - Parsed data tables
   - Editable graph data

![Extraction history with green completed card](screenshots/pdf-extraction-history.png)

### Step 4: Return and Add Extraction to Chat Context

1. Click on 'Back to Upload'

2. Scroll down to 'Extraction History'

3. In the extraction detail view, click **"Add to Chat"**

4. You will be redirected to the Research Chat view

5. The extraction now appears as an attachment, providing context for AI analysis

6. Ask the AI to write a python script creating a graph comparing the drugs from the paper (if you used the template paper. If not, you might find a bug and we'd love to hear from you!)

7. Please note the spinning circle in the searchbar ensuring that processing is happening. 

8. Review the graph and copy the code for your own use if you wish. 

![Generated graph comparing drug efficacy](screenshots/generated-graph.png)

### Step 5: Monitor Real-Time Clinical Trial Updates

To track ongoing developments that may impact investment decisions:

1. Click the **"Realtime Feed"** tab in the top navigation

2. Click **"Watch New Feed"**

3. In the search field, enter the drug name (e.g., "Tirzepatide"). You can leave the custom label field blank and leave email notifications off for now.

4. Click on the **"Start Watching"**
   - Processing takes approximately 60-120 seconds as the system scrapes ClinicalTrials.gov

5. Review the timeline of trial updates from the past 14 days by clicking on the card on the left side of the screen you just generated.

6. Click **"AI Investment Insights"** to generate a summary analyzing whether recent updates signal:
   - **Buy signals** - Positive trial results, expanded indications, regulatory progress
   - **Sell signals** - Trial failures, adverse events, regulatory setbacks

This real-time monitoring allows you to react quickly to material changes in a drug's development trajectory.

![Realtime Feed timeline with investment insights panel](screenshots/realtime-feed-timeline.png)

---

## Summary

ABCresearch streamlines biotech equity research by integrating clinical trial data, academic literature, and real-time monitoring into a single AI-powered platform. Use the broad exploration workflow to identify promising therapeutic areas, then apply deep analysis tools to evaluate specific investment opportunities with data-driven precision.
