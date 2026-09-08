-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'ANALYZING', 'COMPLETED', 'FAILED', 'NO_WEBSITE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'CONTACTED', 'REPLIED', 'FOLLOW_UP', 'MEETING_BOOKED', 'WON', 'LOST', 'NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('DISCOVERED', 'ANALYZED', 'STATUS_CHANGED', 'NOTE_ADDED', 'OUTREACH_GENERATED', 'FOLLOW_UP_GENERATED', 'FOLLOW_UP_SCHEDULED', 'CONTACTED', 'LIST_ADDED', 'LIST_REMOVED', 'EXPORTED');

-- CreateEnum
CREATE TYPE "OutreachChannel" AS ENUM ('EMAIL', 'LINKEDIN', 'WHATSAPP', 'PHONE', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "RadarFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "senderName" TEXT,
    "senderRole" TEXT,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outreachLanguage" TEXT NOT NULL DEFAULT 'en',
    "defaultCountry" TEXT NOT NULL DEFAULT 'NL',
    "signature" TEXT,
    "aiMinOpportunity" INTEGER NOT NULL DEFAULT 40,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "industryKey" TEXT,
    "location" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'NL',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "radiusKm" INTEGER NOT NULL DEFAULT 25,
    "maxResults" INTEGER NOT NULL DEFAULT 60,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "providers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT NOT NULL DEFAULT 'Queued',
    "error" TEXT,
    "totalFound" INTEGER NOT NULL DEFAULT 0,
    "totalNew" INTEGER NOT NULL DEFAULT 0,
    "totalDuplicates" INTEGER NOT NULL DEFAULT 0,
    "analyzedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "noWebsiteCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "savedSearchId" TEXT,
    "radarId" TEXT,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanProspect" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "stage" TEXT,
    "error" TEXT,
    "isNew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanProspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "industryKey" TEXT,
    "website" TEXT,
    "domain" TEXT,
    "hasWebsite" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "email" TEXT,
    "emailSource" TEXT,
    "address" TEXT,
    "street" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "region" TEXT,
    "countryCode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "googlePlaceId" TEXT,
    "googleMapsUrl" TEXT,
    "googleRating" DOUBLE PRECISION,
    "googleReviewCount" INTEGER,
    "businessStatus" TEXT,
    "googleTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "socialLinks" JSONB,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT,
    "websiteScore" INTEGER,
    "designScore" INTEGER,
    "uxScore" INTEGER,
    "seoScore" INTEGER,
    "performanceScore" INTEGER,
    "conversionScore" INTEGER,
    "mobileScore" INTEGER,
    "technicalScore" INTEGER,
    "opportunityScore" INTEGER,
    "platform" TEXT,
    "recommendedService" TEXT,
    "priorityLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "insights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "issueKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ageVerdict" TEXT,
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "analysisError" TEXT,
    "lastAnalyzedAt" TIMESTAMP(3),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "contactedAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "dateFound" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteAnalysis" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "finalUrl" TEXT,
    "domain" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "httpStatus" INTEGER,
    "isHttps" BOOLEAN NOT NULL DEFAULT false,
    "httpsRedirects" BOOLEAN NOT NULL DEFAULT false,
    "redirectCount" INTEGER NOT NULL DEFAULT 0,
    "sslError" TEXT,
    "responseTimeMs" INTEGER,
    "htmlBytes" INTEGER,
    "fetchError" TEXT,
    "fetchOutcome" TEXT NOT NULL DEFAULT 'ok',
    "screenshotDesktop" TEXT,
    "screenshotMobile" TEXT,
    "screenshotFull" TEXT,
    "title" TEXT,
    "metaDescription" TEXT,
    "h1" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "headingOutline" JSONB,
    "canonical" TEXT,
    "robotsTxtFound" BOOLEAN,
    "sitemapFound" BOOLEAN,
    "schemaTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasLocalBusinessSchema" BOOLEAN NOT NULL DEFAULT false,
    "ogTags" JSONB,
    "hasViewport" BOOLEAN NOT NULL DEFAULT false,
    "imagesTotal" INTEGER NOT NULL DEFAULT 0,
    "imagesMissingAlt" INTEGER NOT NULL DEFAULT 0,
    "isIndexable" BOOLEAN NOT NULL DEFAULT true,
    "lang" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "hasFavicon" BOOLEAN NOT NULL DEFAULT false,
    "linksInternal" INTEGER NOT NULL DEFAULT 0,
    "linksExternal" INTEGER NOT NULL DEFAULT 0,
    "linksChecked" INTEGER NOT NULL DEFAULT 0,
    "linksBroken" INTEGER NOT NULL DEFAULT 0,
    "brokenLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ctaAboveFold" BOOLEAN NOT NULL DEFAULT false,
    "ctaCount" INTEGER NOT NULL DEFAULT 0,
    "ctaTexts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasContactForm" BOOLEAN NOT NULL DEFAULT false,
    "phoneVisible" BOOLEAN NOT NULL DEFAULT false,
    "emailVisible" BOOLEAN NOT NULL DEFAULT false,
    "hasSocialProof" BOOLEAN NOT NULL DEFAULT false,
    "hasReviewsWidget" BOOLEAN NOT NULL DEFAULT false,
    "hasPortfolio" BOOLEAN NOT NULL DEFAULT false,
    "hasTrustSignals" BOOLEAN NOT NULL DEFAULT false,
    "hasNav" BOOLEAN NOT NULL DEFAULT false,
    "navLinks" INTEGER NOT NULL DEFAULT 0,
    "hasBookingFlow" BOOLEAN NOT NULL DEFAULT false,
    "hasWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "hasChat" BOOLEAN NOT NULL DEFAULT false,
    "hasMapEmbed" BOOLEAN NOT NULL DEFAULT false,
    "addressOnPage" BOOLEAN NOT NULL DEFAULT false,
    "heroText" TEXT,
    "copyrightYear" INTEGER,
    "fontFamilies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "usesWebFonts" BOOLEAN NOT NULL DEFAULT false,
    "legacyMarkup" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mobileHorizontalOverflow" BOOLEAN,
    "mobileSmallTextRatio" DOUBLE PRECISION,
    "mobileTapTargetIssues" INTEGER,
    "mobileMenuPresent" BOOLEAN,
    "jsErrors" INTEGER NOT NULL DEFAULT 0,
    "jsErrorSamples" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mixedContent" BOOLEAN NOT NULL DEFAULT false,
    "requestsCount" INTEGER NOT NULL DEFAULT 0,
    "totalTransferBytes" INTEGER,
    "domNodes" INTEGER,
    "ttfbMs" INTEGER,
    "domContentLoadedMs" INTEGER,
    "loadMs" INTEGER,
    "failedRequests" INTEGER NOT NULL DEFAULT 0,
    "cms" TEXT,
    "framework" TEXT,
    "analytics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pixels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hosting" TEXT,
    "server" TEXT,
    "jsLibraries" JSONB,
    "technologies" JSONB,
    "psiMobile" JSONB,
    "psiDesktop" JSONB,
    "psiPerformanceMobile" INTEGER,
    "psiPerformanceDesktop" INTEGER,
    "psiAccessibility" INTEGER,
    "psiBestPractices" INTEGER,
    "psiSeo" INTEGER,
    "psiError" TEXT,
    "lcpMs" DOUBLE PRECISION,
    "cls" DOUBLE PRECISION,
    "tbtMs" DOUBLE PRECISION,
    "fcpMs" DOUBLE PRECISION,
    "speedIndexMs" DOUBLE PRECISION,
    "cruxAvailable" BOOLEAN NOT NULL DEFAULT false,
    "ageSignals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ageVerdict" TEXT NOT NULL DEFAULT 'unknown',
    "checks" JSONB NOT NULL DEFAULT '[]',
    "issues" JSONB NOT NULL DEFAULT '[]',
    "scores" JSONB NOT NULL DEFAULT '{}',
    "insights" JSONB NOT NULL DEFAULT '[]',
    "aiStatus" TEXT NOT NULL DEFAULT 'not_configured',
    "aiModel" TEXT,
    "aiSummary" TEXT,
    "aiStrengths" JSONB,
    "aiIssues" JSONB,
    "aiOpportunities" JSONB,
    "aiRecommendedService" TEXT,
    "aiDesignImpression" INTEGER,
    "aiError" TEXT,
    "aiAnalyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "List" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListProspect" (
    "listId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListProspect_pkey" PRIMARY KEY ("listId","prospectId")
);

-- CreateTable
CREATE TABLE "OutreachMessage" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "OutreachChannel" NOT NULL,
    "tone" TEXT NOT NULL,
    "length" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpIndex" INTEGER,
    "followUpAfterDays" INTEGER,
    "parentId" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Radar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "industryKey" TEXT,
    "location" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'NL',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "radiusKm" INTEGER NOT NULL DEFAULT 25,
    "maxResults" INTEGER NOT NULL DEFAULT 60,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "frequency" "RadarFrequency" NOT NULL DEFAULT 'WEEKLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "listId" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "newProspectsTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Radar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "Scan_userId_createdAt_idx" ON "Scan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Scan_status_idx" ON "Scan"("status");

-- CreateIndex
CREATE INDEX "ScanProspect_prospectId_idx" ON "ScanProspect"("prospectId");

-- CreateIndex
CREATE UNIQUE INDEX "ScanProspect_scanId_prospectId_key" ON "ScanProspect"("scanId", "prospectId");

-- CreateIndex
CREATE INDEX "Prospect_userId_opportunityScore_idx" ON "Prospect"("userId", "opportunityScore");

-- CreateIndex
CREATE INDEX "Prospect_userId_websiteScore_idx" ON "Prospect"("userId", "websiteScore");

-- CreateIndex
CREATE INDEX "Prospect_userId_domain_idx" ON "Prospect"("userId", "domain");

-- CreateIndex
CREATE INDEX "Prospect_userId_phoneNormalized_idx" ON "Prospect"("userId", "phoneNormalized");

-- CreateIndex
CREATE INDEX "Prospect_userId_status_idx" ON "Prospect"("userId", "status");

-- CreateIndex
CREATE INDEX "Prospect_userId_city_idx" ON "Prospect"("userId", "city");

-- CreateIndex
CREATE INDEX "Prospect_userId_followUpAt_idx" ON "Prospect"("userId", "followUpAt");

-- CreateIndex
CREATE INDEX "Prospect_userId_dateFound_idx" ON "Prospect"("userId", "dateFound");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_userId_googlePlaceId_key" ON "Prospect"("userId", "googlePlaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteAnalysis_prospectId_key" ON "WebsiteAnalysis"("prospectId");

-- CreateIndex
CREATE INDEX "WebsiteAnalysis_domain_fetchedAt_idx" ON "WebsiteAnalysis"("domain", "fetchedAt");

-- CreateIndex
CREATE INDEX "Note_prospectId_createdAt_idx" ON "Note"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_prospectId_createdAt_idx" ON "Activity"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "List_userId_name_key" ON "List"("userId", "name");

-- CreateIndex
CREATE INDEX "ListProspect_prospectId_idx" ON "ListProspect"("prospectId");

-- CreateIndex
CREATE INDEX "OutreachMessage_prospectId_createdAt_idx" ON "OutreachMessage"("prospectId", "createdAt");

-- CreateIndex
CREATE INDEX "OutreachMessage_userId_createdAt_idx" ON "OutreachMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_createdAt_idx" ON "SavedSearch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Radar_userId_idx" ON "Radar"("userId");

-- CreateIndex
CREATE INDEX "Radar_isActive_nextRunAt_idx" ON "Radar"("isActive", "nextRunAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_radarId_fkey" FOREIGN KEY ("radarId") REFERENCES "Radar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanProspect" ADD CONSTRAINT "ScanProspect_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanProspect" ADD CONSTRAINT "ScanProspect_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteAnalysis" ADD CONSTRAINT "WebsiteAnalysis_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "List" ADD CONSTRAINT "List_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListProspect" ADD CONSTRAINT "ListProspect_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListProspect" ADD CONSTRAINT "ListProspect_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OutreachMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Radar" ADD CONSTRAINT "Radar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Radar" ADD CONSTRAINT "Radar_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;
