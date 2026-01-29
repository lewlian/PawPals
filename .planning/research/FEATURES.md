# Feature Landscape

**Domain:** Location-based check-in app for dog park communities
**Researched:** 2026-01-29
**Confidence:** MEDIUM (based on WebSearch findings from active products, not verified with official documentation)

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **One-tap check-in** | Core value proposition of check-in apps; Swarm established this pattern | Low | Telegram inline keyboard makes this trivial |
| **See who's there now** | Primary use case: "Should I go to the park right now?" | Low | Real-time occupancy list; DogPack and Wag Buddy both emphasize this |
| **Basic dog profile (name, size, breed)** | Users need to know if their dog will be compatible | Low | Minimum viable: name + size category. Breed is nice-to-have. |
| **Manual check-out** | Users expect control over their session | Low | Simple "Leave" button |
| **Location list** | Must show available dog runs to check into | Low | PawPals has 11 pre-loaded Singapore locations |
| **Session auto-expiry** | Prevents stale data ("ghost dogs" shown as present when they've left) | Medium | Industry standard: 15min-2hrs for location sessions. Recommend 2-3 hours for dog park visits. |
| **Privacy: Anonymous browsing** | Some users want to see occupancy without revealing presence | Low | Allow viewing without checking in (default Telegram behavior) |
| **Current occupancy count** | Quick "how busy is it?" signal before deciding to go | Low | Aggregate count by dog size category |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Size-based filtering** | Singapore dog runs have size restrictions; critical for safety | Low | Small (<10kg) vs Large (>10kg). Already in PawPals spec. **This is actually table stakes for Singapore context.** |
| **Temperament flags** | Helps owners avoid bad matches (reactive dog + playful puppies = problem) | Medium | Simple tags: Shy, Playful, Reactive, Calm. Optional field. |
| **Friend notifications** | "Your dog's friends are at the park!" (Wag Buddy feature) | High | Requires friend system + push notifications. Defer to post-MVP. |
| **Park busyness history** | "Usually busy on Saturday mornings" - helps planning | Medium | Aggregate historical check-in data. Post-MVP feature. |
| **Proximity alerts** | Notify when you're near a dog run with compatible dogs | High | Requires Telegram live location tracking (8hr max). Complex privacy concerns. |
| **Park ratings/reviews** | User feedback on facilities, safety, cleanliness | Low-Medium | Simple 5-star + text. Standard community feature. |
| **Playdates/scheduling** | "I'll be there tomorrow at 4pm, who wants to join?" | Medium | Async coordination feature. Different UX from real-time check-in. |
| **Lost & found alerts** | Community-powered lost pet reports | Medium | Valuable safety feature but different product vertical. Scope creep risk. |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full social network (posts, comments, feed)** | Turns focused tool into generic social media. "When you split your application into tiny services, you don't remove complexity, you just move it from your code to your network." Scope creep kills MVPs. | Keep it utility-focused: check-in, see who's there, leave. Social features belong in existing platforms (Telegram groups). |
| **In-app messaging between users** | Reinventing what Telegram already does perfectly. Users won't adopt. | Leverage Telegram's native messaging. Show usernames, let them DM directly in Telegram. |
| **Complex animations/UI flourishes** | "Excessive animations can transform an app into a sluggish spectacle...contribute to performance lags on mid-range devices." Users expect instant responses in utility apps. | Fast, functional, boring. Telegram bots have UI constraints anyway. |
| **Pet service marketplace (groomers, walkers, vets)** | DogHood and others already do this. Requires vetting, liability, payments. Massive scope. | Focus on the check-in problem. Don't become a directory. |
| **Photo sharing per check-in** | Storage costs, moderation overhead, slows check-in flow. Swarm removed this emphasis. | Optional link to share in Telegram groups, but not core to check-in UX. |
| **Gamification (badges, mayorships, streaks)** | Swarm has this, but it's distracting for utility apps. "Users don't care about your tech stack or architecture—they care if the button works when they click it." | Maybe add simple stats ("15 visits this month") post-MVP, but no points/badges. |
| **Live location tracking** | Telegram supports it but 8hr max duration, high battery drain, privacy concerns. Over-engineered for "check in when you arrive" use case. | Static check-in when user arrives. Auto-expiry handles departure. |
| **Custom map implementation** | Telegram inline keyboards can't show custom maps. Would require web app. Overcomplicates bot UX. | Text-based location list is sufficient. Telegram can show static map when sharing location. |

## Feature Dependencies

```
Core Check-in Flow (MVP Phase 1):
├── Location List (11 Singapore dog runs)
├── Dog Profile Creation
│   ├── Name
│   ├── Size (Small/Large)
│   └── [Optional: Breed]
├── Check-in Action
│   ├── Select location
│   ├── Select dog (if owner has multiple)
│   └── Confirm
├── Occupancy View
│   ├── See current dogs checked in
│   ├── Filter by size
│   └── View count
├── Check-out Action
│   ├── Manual check-out button
│   └── Auto-expiry (2-3 hours)
└── Session Management
    └── Server-side timeout enforcement

Post-MVP Dependencies:
├── Temperament → Requires dog profile
├── Park ratings → Requires user authentication
├── Friend system → Requires social graph (complex)
├── History/analytics → Requires time-series data storage
└── Notifications → Requires Telegram Bot API push + user opt-in
```

## MVP Recommendation

For MVP (PawPals SG initial launch), prioritize:

1. **Basic check-in/check-out flow** - Core utility; everything else is secondary
2. **Real-time occupancy view with size filtering** - The "should I go now?" question
3. **Simple dog profiles (name + size)** - Minimum to make check-ins meaningful
4. **Session auto-expiry (2-3 hours)** - Prevents stale data without manual intervention
5. **11 pre-loaded Singapore locations** - Defined scope; no user-generated content yet

**Intentionally exclude from MVP:**
- Temperament tags (adds friction to profile creation; can add later if users request)
- Breed identification (nice-to-have; size is sufficient for safety)
- Friend notifications (requires complex social graph)
- Historical analytics (need data first)
- Ratings/reviews (adds moderation burden)
- Photo uploads (storage costs, not core to "is the park busy?" question)
- Playdates/scheduling (different use case from real-time check-in)

**Defer to post-MVP:**
- **Temperament flags**: Wait for user feedback. Add if owners report bad matches.
- **Park ratings**: Add once you have consistent user base per location.
- **Friend system**: Only if users explicitly request it. High complexity, low ROI initially.
- **Breed field**: Add to profile if users ask for it. Not needed for MVP safety filtering.

**Phase 2 (after validating MVP):**
If users adopt the core check-in flow, add:
1. Temperament tags (low complexity, high safety value)
2. Simple park ratings (5-star + optional comment)
3. Notification opt-in for favorite parks ("Golden Mile park has 3 large dogs now")

**Phase 3 (mature product):**
Only if there's sustained engagement:
1. Historical busyness patterns ("Usually busy 5-7pm weekdays")
2. Friend system with notifications
3. Playdates/scheduling feature

## Complexity Assessment

| Feature Category | Complexity | Rationale |
|------------------|------------|-----------|
| **Check-in/out** | Low | Standard CRUD + session management |
| **Occupancy view** | Low | Read from active sessions table, filter by size |
| **Dog profiles** | Low | Simple user data model |
| **Auto-expiry** | Medium | Server-side cron job + session cleanup. Industry standard 15min-2hr for location apps; recommend 2-3hr for dog park visits per OWASP session management guidelines. |
| **Size filtering** | Low | Simple enum: Small (<10kg) / Large (>10kg) |
| **Temperament tags** | Low-Medium | UI friction concern, but data model is simple |
| **Notifications** | High | Telegram Bot API push notifications + user preferences + trigger logic |
| **Friend system** | High | Social graph + privacy settings + notification routing |
| **Historical analytics** | Medium | Time-series aggregation; database design consideration |
| **Proximity alerts** | High | Requires Telegram live location (8hr max), background processing, privacy UX |

## Sources

**Location-based check-in apps:**
- [Foursquare Swarm - Wikipedia](https://en.wikipedia.org/wiki/Foursquare_Swarm)
- [Check in and track places | Swarm by Foursquare](https://swarmapp.com/)
- [Swarm by Foursquare - App Store](https://apps.apple.com/us/app/swarm-by-foursquare/id870161082)
- [Top 10 Best Event Check-In Apps for 2026](https://mapdevents.com/blog/10-best-event-check-in-apps-2026)
- [OneTap: Simple Attendance Tracking & Check-In App](https://www.onetapcheckin.com/)

**Pet community apps:**
- [Social Media for Dog Owners in 2026: 5 Apps for Our Furry Friends](https://www.dogster.com/lifestyle/social-media-apps-for-dog-owners)
- [DogHood: Dog Lovers Community App](https://apps.apple.com/us/app/doghood-dog-lovers-community/id1547568850)
- [Pawmates: The Pet Social Media App](https://apps.apple.com/us/app/pawmates-the-pet-social-media/id1397983772)
- [Petzbe - A Social Media Pet App](https://petzbe.com/)
- [19 Must-Have Apps for Dog Owners in 2026](https://articles.hepper.com/must-have-apps-for-dog-owners/)

**Dog park check-in apps:**
- [Wag Buddy - Make Your Dog Happy](https://wagbuddy.app/)
- [DogPack: Dog Friendly Spots](https://www.dogpackapp.com/)
- [Paw Parks App](https://apps.apple.com/us/app/paw-parks/id937974538)

**Telegram Bot location features:**
- [Live geolocation - Telegram Core API](https://core.telegram.org/api/live-location)
- [Real-Time Location Sharing with Telegram Bots](https://golubevcg.com/post/real-time_location_sharing_with_telegram_bots)
- [Latest Telegram Location Settings: Tips & Tricks for 2026](https://itoolab.com/location/telegram-location-settings/)

**Session management & security:**
- [Session Management - OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Session and state management in ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/app-state?view=aspnetcore-8.0)
- [Idle Session Timeout Best Practice](https://www.timify.com/en/blog/session-timeout-set-up-best-practice-protection-with-timify/)

**Anti-patterns & over-engineering:**
- [7 UI Pitfalls Mobile App Developers Should Avoid in 2026](https://www.webpronews.com/7-ui-pitfalls-mobile-app-developers-should-avoid-in-2026/)
- [My 2026 Tech Stack is Boring as Hell (And That is the Point)](https://dev.to/the_nortern_dev/my-2026-tech-stack-is-boring-as-hell-and-that-is-the-point-20c1)
- [8 platform engineering anti-patterns | InfoWorld](https://www.infoworld.com/article/4064273/8-platform-engineering-anti-patterns.html)
