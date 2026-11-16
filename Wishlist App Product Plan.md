# **Product Plan: Couple's Wishlist Platform**

# **1\. Concept & Vision**

The Wishlist Platform is a dedicated, private shopping ecosystem crafted specifically for couples, friend groups, and families to share, organize, and purchase gifts for one another without ruining the element of surprise. Central to this experience is the concept of "Circles" (or "Groups"), enabling shared wishlist spaces tailored for pair or multi-member dynamics.

Traditional wishlists often struggle with real-time sync, lack privacy controls around purchasing status, or require complex configurations. This platform solves these issues by establishing a flexible multi-user pairing system via custom Circles. Members maintain their own curated item lists while gaining exclusive visibility into each other's desires within a group. Intelligent tracking ensures that when an item is purchased, it is immediately reserved across all group members without alerting the recipient, preserving the joy and magic of gift-giving.

---

# **2\. User Onboarding & Group Linking**

To create a seamless user onboarding journey, the system utilizes a lightweight **"Circle/Group Invite Code"** protocol. This eliminates the friction of complex invitation links or manual database matching.

## **The Circle Invite Code Flow**

1. **Circle Creation & Code Generation (User A):**  
   * User A creates an account using standard credentials.  
   * Upon creating a Circle, the platform assigns User A a unique, secure 6-character alphanumeric invite code (e.g., `GROUP-84`).  
   * User A's dashboard displays a primary call-to-action: *"Invite friends or a partner to your Circle."*  
2. **Sharing & Inviting:**  
   * User A transmits the invite code to multiple friends or family members via their preferred messaging platform.  
3. **Registration & Multi-Member Joining (User B, C, D, etc.):**  
   * Invitees create accounts and are prompted with options: *Create New Circle* or *Enter Circle Invite Code*.  
   * Multiple friends can input the exact same code during registration to join the single shared group workspace.  
   * The platform instantly validates the code, binds all members in the data layer, and redirects users to the unified Circle workspace.  
   * **Note on Multi-Circle Support:** Users are not restricted to one group; they can belong to multiple Circles simultaneously (e.g., maintaining one private Circle with their partner and a separate Circle for a friend group of 5+ members).

```
                                                              │

```

---

# **3\. Core Features**

## **Automated Link Parsing**

Users can paste any product URL from major online retailers into the quick-add bar. The platform’s underlying extraction engine automatically retrieves critical product details to construct a clean, uniform card interface.

* **Extracted Attributes:** High-resolution primary image, canonical product title, current retail price, and target domain name.  
* **Manual Override:** Users can edit extracted titles or custom-adjust prices if the automated parser encounters restricted page metadata.

## **Priority Categorization**

To communicate actual desire levels and avoid guesswork, users assign a numerical priority rating from **1 to 10** for every added item.

| Rating Level | Category Intent | Example Items |
| :---- | :---- | :---- |
| **9 – 10** | High Desire / Essential | Ergonomic mechanical keyboard, daily-wear jacket |
| **6 – 8** | Moderate Interest | Specific book collector's edition, specialty coffee beans |
| **1 – 5** | Nice-to-Have / Low Priority | Travel hairspray, casual desk knick-knack |

## **Flexible Viewing Layouts**

The shared workspace features a view toggle suited to different user preferences and device constraints:

* **Visual Grid Layout:** A responsive masonry layout prioritizing high-quality product imagery and visual priority badges. Ideal for browsing on desktop or tablet.  
* **Compact List Layout:** A dense, scannable table view highlighting pricing, priority scores, and quick action buttons. Ideal for rapid reviewing on mobile devices.

---

# **4\. Quality of Life (QoL) Enhancements**

## **"Secretly Bought" Functionality**

To prevent duplicate purchases while guaranteeing complete surprise across friend groups and partners:

* **Group Members' View (Friends B, C, D, E):** When Friend B marks Friend A's item as **"Secretly Bought,"** the status updates instantly to **"Claimed/Bought"** across the dashboards of Friends C, D, and E to prevent double-buying.  
* **The Recipient's View (Friend A):** Friend A's active wishlist remains completely unchanged and un-updated. The item continues to display as unpurchased to Friend A, ensuring the surprise remains completely intact until opened.

## **Occasion Tagging**

Users can categorize items by specific gift-giving events to assist partners in filtering items based on upcoming dates.

* Supported default tags: `Anniversary`, `Birthday`, `Holiday`, `Valentine's Day`, and `Just Because`.  
* Filter controls allow users to view their partner's wishlist filtered by specific upcoming occasions.

## **Price Drop Alerts**

The platform periodically re-evaluates saved product URLs to track pricing changes over time.

* **Visual Badging:** Items experiencing a drop from their original baseline price are highlighted with a prominent **"Sale"** badge.  
* **Price History:** Displays the original price alongside the discounted rate, allowing partners to strike when deals are active.

## **Mobile Share Integration**

The application integrates with native mobile operating system share sheets.

* While browsing any mobile browser or retail application, users tap the native **Share** icon and select the Wishlist App icon.  
* The URL is ingested in the background, executing the link parser and adding the item to the user's wishlist without interrupting their browsing session.

---

# **5\. Next Steps & Timeline**

```
[Phase 1: Foundation] ──> [Phase 2: Core Parsing] ──> [Phase 3: QoL Features]
    Account Pairing            Link Scraping             "Secretly Bought"
    Dashboard Layout           Priority System           Mobile OS Integration
```

1. **Phase 1 (Setup):** Complete user authentication, database schema design, and the Partner Code linking flow.  
2. **Phase 2 (Core):** Build the automated URL parsing service and dynamic Grid/List dashboard views.  
3. **Phase 3 (Enhancements):** Deploy the "Secretly Bought" state management, automated price tracking, and mobile share extension integrations.

