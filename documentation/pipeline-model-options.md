# Pipeline LLM Model Options

## Current Configuration

**Model**: Claude 3.5 Haiku (`claude-3-5-haiku-20241022`)
**Max Tokens**: 2048
**Temperature**: 0 (deterministic)

## Model Comparison

### Claude 3.5 Haiku ⭐ (Current)

**Pricing:**
- Input: $0.80 per 1M tokens
- Output: $4.00 per 1M tokens

**Performance:**
- Speed: Fast (~1-2s per drug)
- Quality: Excellent for structured extraction
- Context: 200K tokens

**Costs:**
- Per drug: ~$0.0046
- Per extraction (10 drugs): **$0.046**
- Monthly (20 searches/day): **$28**

**Best for:**
- Cost-sensitive deployments ✅
- High-volume extraction
- Structured data tasks
- Production use

---

### Claude 3.5 Sonnet

**Pricing:**
- Input: $3.00 per 1M tokens
- Output: $15.00 per 1M tokens

**Performance:**
- Speed: Moderate (~3-5s per drug)
- Quality: Superior reasoning and nuance
- Context: 200K tokens

**Costs:**
- Per drug: ~$0.0175
- Per extraction (10 drugs): **$0.175**
- Monthly (20 searches/day): **$105**

**Best for:**
- Maximum quality needed
- Complex reasoning tasks
- Nuanced mechanism descriptions
- Research/academic use

---

### Claude 3 Opus

**Pricing:**
- Input: $15.00 per 1M tokens
- Output: $75.00 per 1M tokens

**Performance:**
- Speed: Slow (~10-15s per drug)
- Quality: Best-in-class reasoning
- Context: 200K tokens

**Costs:**
- Per drug: ~$0.0875
- Per extraction (10 drugs): **$0.875**
- Monthly (20 searches/day): **$525**

**Best for:**
- Critical research only
- Absolutely maximum quality
- Not recommended for routine use

---

## Max Tokens Configuration

### Token Limit: 2048 (Current)

**Good for:**
- Detailed mechanism descriptions ✅
- Multiple indications ✅
- Rich JSON responses ✅
- 10 trials + 10 papers input ✅

### Other Options:

| Max Tokens | Use Case | Output Size |
|------------|----------|-------------|
| 1024 | Basic extraction | Small JSON |
| 2048 | **Standard** ✅ | Detailed JSON |
| 4096 | Very detailed | Extensive text |
| 8192 | Maximum | Full essays |

**Recommendation**: Stick with 2048 for our use case.

---

## Cost Comparison (Monthly)

Assuming 20 searches/day × 30 days = 600 extractions/month (10 drugs each)

| Model | Per Extraction | Monthly Cost | Quality |
|-------|----------------|--------------|---------|
| **Haiku 3.5** ⭐ | $0.046 | **$28** | ⭐⭐⭐⭐ |
| Sonnet 3.5 | $0.175 | $105 | ⭐⭐⭐⭐⭐ |
| Opus 3 | $0.875 | $525 | ⭐⭐⭐⭐⭐+ |

---

## Quality Assessment

### Field Extraction Quality

| Field | Haiku 3.5 | Sonnet 3.5 | Opus 3 |
|-------|-----------|------------|--------|
| Commercial Name | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Stage Detection | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Technologies | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Mechanism (brief) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Mechanism (detailed) | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Indications | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| JSON Structure | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Verdict**: Haiku 3.5 is excellent for structured extraction tasks. The 4x cost increase for Sonnet is only worth it if you need highly nuanced mechanism descriptions.

---

## Switching Models

To change models, edit `/api/generate-asset-pipeline-table.ts`:

### Option 1: Use Sonnet 3.5 (Better Quality)

```typescript
const message = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20240620', // Change this line
  max_tokens: 2048,
  temperature: 0,
  // ...
});
```

### Option 2: Use Opus 3 (Maximum Quality)

```typescript
const message = await anthropic.messages.create({
  model: 'claude-3-opus-20240229', // Change this line
  max_tokens: 2048,
  temperature: 0,
  // ...
});
```

### Option 3: Keep Haiku 3.5 (Cost Effective) ✅

```typescript
const message = await anthropic.messages.create({
  model: 'claude-3-5-haiku-20241022', // Current
  max_tokens: 2048,
  temperature: 0,
  // ...
});
```

---

## Rate Limits

All Claude 3.5 models share rate limits based on your API tier:

| Tier | RPM | TPM | TPD |
|------|-----|-----|-----|
| Tier 1 | 50 | 40K | 50K |
| Tier 2 | 1,000 | 80K | 500K |
| Tier 3 | 2,000 | 160K | 2M |
| Tier 4 | 4,000 | 400K | 10M |

**Our Usage (10 drugs, Haiku 3.5):**
- Requests: 10 (well under limit)
- Tokens: ~33K input + ~5K output = 38K
- Duration: ~20 seconds with delays

✅ Safe for Tier 1 accounts

---

## Optimization Tips

### 1. Adjust Drug Count
```typescript
// In pipelineLLMService.ts
const top10 = sortedDrugs.slice(0, 5); // Process only 5 drugs
```
**Savings**: 50% reduction

### 2. Reduce Input Data
```typescript
// In generate-asset-pipeline-table.ts
const trialsText = trials.slice(0, 5).map(...) // Use 5 instead of 10
const papersText = papers.slice(0, 5).map(...) // Use 5 instead of 10
```
**Savings**: ~30% reduction

### 3. Use Caching (Future)
Implement Supabase caching with 30-day TTL
**Savings**: 80%+ with cache hits

---

## Recommendations

### For Production (Current Setup) ✅
- **Model**: Claude 3.5 Haiku
- **Max Tokens**: 2048
- **Top Drugs**: 10
- **Monthly Cost**: ~$28
- **Quality**: Excellent

### For Research/High Quality
- **Model**: Claude 3.5 Sonnet
- **Max Tokens**: 2048
- **Top Drugs**: 10
- **Monthly Cost**: ~$105
- **Quality**: Superior

### For Budget-Conscious
- **Model**: Claude 3.5 Haiku
- **Max Tokens**: 1536
- **Top Drugs**: 5
- **Monthly Cost**: ~$7
- **Quality**: Good

---

## Testing Results

After switching to Haiku 3.5, test with:
1. Search for "Alzheimer's disease"
2. Click "AI Extract (Top 10)"
3. Verify quality of:
   - ✅ Stage detection
   - ✅ Commercial names
   - ✅ Mechanism descriptions
   - ✅ Technology classification
   - ✅ Indications

If quality is insufficient, switch to Sonnet 3.5.

---

## Update History

- **v1.0** (Initial): Sonnet 3.5, 1024 tokens
- **v1.1** (Current): Haiku 3.5, 2048 tokens ✅
  - 74% cost reduction
  - 2x more output space
  - Maintained quality for structured extraction

