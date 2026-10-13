export type GuideSection = {
  id: string;
  title: string;
  paragraphs: string[];
  steps?: string[];
  note?: string;
  table?: { label: string; headings: string[]; rows: string[][] };
};

export type Guide = {
  slug: string;
  title: string;
  description: string;
  category: string;
  minutes: number;
  updated: string;
  image: string;
  imageAlt: string;
  imageWidth?: number;
  imageHeight?: number;
  video?: string;
  poster?: string;
  related: string[];
  sections: GuideSection[];
};

export const GUIDES: Guide[] = [
  {
    slug: "getting-started",
    title: "Get started with Pocket for Mac",
    description: "Set your starting balance, record your first purchase and add a bill in Pocket for Mac.",
    category: "Start here",
    minutes: 4,
    updated: "2026-10-13",
    image: "/media/overview-2026-10-13.png",
    imageAlt: "Pocket Overview with the recorded balance and money entries",
    imageWidth: 2128,
    imageHeight: 1692,
    related: ["quick-add-spending", "expected-income", "back-up-your-data"],
    sections: [
      {
        id: "starting-balance",
        title: "Start with the money you have today",
        paragraphs: [
          "Pocket is a manual money tracker for macOS. Its menu bar balance comes from your starting amount and the entries you record. It does not read your bank account.",
          "Choose which money you want to track, such as the balance in your everyday spending account. Record money coming into and going out of that account, and use one currency.",
        ],
        steps: [
          "Download Pocket from pocketleft.app, open the disk image and drag Pocket into Applications. Open the app.",
          "Enter your current amount. Choose “I'm below zero by” if you are starting with a negative balance. An empty amount starts at zero.",
          "Choose your currency. Pocket uses one currency at a time. Changing it later changes the label without converting the amounts.",
          "Choose whether Pocket should open when you log in, then click Start. Your recorded balance appears in the menu bar.",
        ],
        note: "If today's balance already includes an old purchase or paycheck, entering that transaction again changes the balance twice. Start from today and record changes from that point onward.",
      },
      {
        id: "first-entry",
        title: "Record one purchase and check the balance",
        paragraphs: ["Click the menu bar balance to open Pocket, or use the entry field in Overview. Keep the minus button selected for spending, then enter the amount and describe the purchase. Choose a category from the icon to the left of the description. Press Return to save."],
        table: {
          label: "Balance after each entry",
          headings: ["Entry", "Change", "Recorded balance"],
          rows: [["Starting amount", "$500.00", "$500.00"], ["Coffee", "−$4.50", "$495.50"], ["Money received", "+$120.00", "$615.50"]],
        },
        note: "A missing or duplicate entry can make Pocket's balance differ from your bank's.",
      },
      {
        id: "first-plan",
        title: "Add one upcoming bill",
        paragraphs: [
          "Click the sliders icon to the right of the amount field. It opens the full entry form, where you can set the date, category and repeat schedule. Enter the bill's amount, description and next date. Choose Repeat for a weekly, every-two-weeks, monthly or yearly payment. Leave the number of payments empty if it has no end date.",
          "An automatic payment counts on its date. Turn on Confirm each payment if you want to record the actual amount and date yourself. Those payments wait for confirmation in Overview.",
          "Open Plan to see your projected balance after each scheduled payment. The chart includes only the money you have recorded or planned.",
        ],
      },
      {
        id: "keep-current",
        title: "Check for missing or duplicate entries",
        paragraphs: [
          "Compare Pocket's balance with the account you used for your starting amount. If they differ, check for missing entries, duplicates and incorrect dates. Use Edit on an entry to correct it.",
          "Save a quick-add button for purchases you make often, then add your remaining upcoming bills and income.",
        ],
      },
    ],
  },
  {
    slug: "quick-add-spending",
    title: "Track everyday spending with quick-add buttons",
    description: "Save a frequent purchase in Pocket, use Command-1 through Command-9 and choose when a button should ask for the amount.",
    category: "Everyday spending",
    minutes: 3,
    updated: "2026-10-13",
    image: "/media/quick-add-2026-10-12.jpg",
    imageAlt: "Pocket quick-add buttons above the spending entry field",
    video: "/media/quick-add-2026-10-12.mp4",
    poster: "/media/quick-add-2026-10-12.webp",
    related: ["getting-started", "expected-income"],
    sections: [
      {
        id: "fixed-amount",
        title: "Save a purchase you make often",
        paragraphs: [
          "Quick-add buttons reuse an entry's description, type and category. Save an amount to record the purchase immediately, or leave it empty to enter a price each time.",
          "A Coffee button with an amount of 4.50 records a 4.50 purchase each time you use it. Create it when you record your next coffee.",
        ],
        steps: [
          "Click the sliders icon to the right of the amount field. In the full entry form, choose Spent and enter the purchase's amount and description.",
          "Choose a category and turn on Save as a quick-add button. Save the entry. This records the purchase and creates its button.",
          "Use the saved button for the next purchase. A button with a fixed amount adds another entry immediately.",
        ],
        note: "Saving the first entry already counts it. Pressing its new button immediately afterward records a second purchase.",
      },
      {
        id: "variable-amount",
        title: "Ask for the amount when the price changes",
        paragraphs: [
          "For groceries, rides or anything with a changing price, open Settings and edit its quick-add button. Leave the amount empty and save the button.",
          "The next time you use it, Pocket fills in the description and category and asks you for the amount. Enter what you actually spent, then save the entry.",
          "You can also create a Money Out or Money In button in Settings. Use Money In for income such as client payments whose amounts vary.",
        ],
      },
      {
        id: "keyboard",
        title: "Use Command-1 through Command-9",
        paragraphs: [
          "With Pocket's window or menu open, Command-1 through Command-9 use the first nine quick-add buttons. The shortcuts work while you are in Pocket.",
          "Check the button order before using a number. If you press the wrong shortcut, find the new entry in your history and edit or delete it.",
        ],
      },
      {
        id: "review",
        title: "Review the entries behind the total",
        paragraphs: [
          "A quick-add button records one entry per use. If the price changes, update its saved amount in Settings.",
          "In Categories, review income and spending by category. The breakdown uses the categories you assigned to your entries.",
        ],
      },
    ],
  },
  {
    slug: "expected-income",
    title: "Track expected income before it arrives",
    description: "Schedule a client payment in Pocket, then confirm the amount and date when it arrives. Follow a $300 payment that arrives late as $280.",
    category: "Upcoming money",
    minutes: 4,
    updated: "2026-10-13",
    image: "/screenshot-plan.png",
    imageAlt: "Pocket Plan with scheduled payments and a projected balance chart",
    related: ["getting-started", "quick-add-spending"],
    sections: [
      {
        id: "two-numbers",
        title: "Keep today's balance and the forecast separate",
        paragraphs: [
          "Schedule a client payment for its expected amount and date, and turn on confirmation. Pocket will wait for you to confirm it before adding the income to your recorded balance.",
          "Your menu bar balance shows recorded money. Plan includes scheduled payments, including income you are still waiting for.",
        ],
      },
      {
        id: "schedule-income",
        title: "Schedule a payment that needs confirmation",
        paragraphs: ["Click the sliders icon to the right of the amount field to open the full entry form. Set a future date or choose a repeating schedule to see the confirmation setting."],
        steps: [
          "Choose Got money and enter the expected amount, such as 300.00, with a description such as Client payment.",
          "Set the expected date. Leave Repeat at Once for a single payment, or choose how often it repeats.",
          "Turn on Confirm when money arrives and save. Check Plan for the scheduled payment.",
          "When the payment is due, find it waiting in Overview. Leave it waiting until you receive the money.",
        ],
        note: "If confirmation is turned off, Pocket counts the scheduled amount automatically on its date. Choose confirmation for payments whose arrival or amount is uncertain.",
      },
      {
        id: "late-payment",
        title: "Confirm what actually arrived",
        paragraphs: [
          "Suppose you start with $500 and expect $300 on October 20. With confirmation enabled and no other entries, your recorded balance stays at $500 until you confirm the payment.",
          "If $280 arrives on October 23, click Got it for the waiting payment. Enter 280.00 and October 23, then confirm. Pocket records the actual amount and date.",
        ],
        table: {
          label: "Recorded balance before and after confirming income",
          headings: ["Event", "Recorded balance"],
          rows: [["Starting amount", "$500.00"], ["$300 expected for October 20", "$500.00"], ["Due, still waiting for confirmation", "$500.00"], ["Confirm $280 received on October 23", "$780.00"]],
        },
        note: "Confirming the waiting payment creates the income entry. Do not also add a separate Got money entry for the same payment, or you will count it twice.",
      },
      {
        id: "forecast-limits",
        title: "Update the plan when expectations change",
        paragraphs: [
          "If a payment will come later, edit its planned date. You can skip a payment, or pause or stop a repeating one, from its controls.",
          "Check uncertain income and missing bills before relying on the forecast. Pocket projects the amounts and dates you enter; purchases you have not recorded or planned are left out.",
        ],
      },
    ],
  },
  {
    slug: "back-up-your-data",
    title: "Back up Pocket and move to a new Mac",
    description: "Find Pocket's data file, export a JSON backup and import it on another Mac. See where daily backups are stored and how optional sync changes the setup.",
    category: "Your data",
    minutes: 3,
    updated: "2026-10-13",
    image: "/screenshot-overview.png",
    imageAlt: "Pocket for Mac, whose local entries can be exported from Settings",
    related: ["getting-started", "expected-income"],
    sections: [
      {
        id: "local-file",
        title: "Find your data file",
        paragraphs: [
          "Pocket saves your money data on your Mac by default. You can use the local app without an account. Entries, planned payments and quick-add buttons are saved together.",
          "Open Settings and click Show in Finder next to Data file. In local mode, the file is normally ~/Library/Application Support/Pocket/ledger.json.",
          "Pocket keeps seven daily backups in its data folder on the same Mac. Keep an exported copy elsewhere so you can recover it if you lose the computer or its drive.",
        ],
      },
      {
        id: "export",
        title: "Export a backup",
        paragraphs: ["Export saves a JSON copy of your money data. Choose a storage location you control."],
        steps: [
          "Open Settings and find Backup.",
          "Click Export and choose a filename and destination. A dated filename makes copies easier to distinguish.",
          "Keep the file somewhere you can access if this Mac stops working, such as an external backup drive.",
        ],
        note: "Export leaves your current data in Pocket.",
      },
      {
        id: "new-mac",
        title: "Import on a new Mac",
        paragraphs: ["Import replaces Pocket's local data. If you already have entries on the new Mac, export them before importing another file."],
        steps: [
          "Install Pocket on the new Mac and open it in local mode.",
          "Transfer your exported JSON file to that Mac.",
          "Open Settings, click Import and select the file. Review the replacement prompt, then confirm Replace.",
          "Check your balance, recent entries, planned payments and quick-add buttons after importing.",
        ],
        note: "Import replaces all local data instead of merging entries. The two Macs keep separate copies unless you set up sync.",
      },
      {
        id: "optional-sync",
        title: "Use sync for a shared balance across devices",
        paragraphs: [
          "With optional self-hosted sync, your chosen server stores the shared main copy. Your Mac keeps a copy in account-ledger.json and queues changes while offline.",
          "You can export while connected. Import is available only in local mode and replaces only the local data.",
          "To use the same balance on your phone or another computer, follow the self-hosting guide and pair devices in Settings under Sync. You will need a server you run.",
        ],
      },
    ],
  },
];

export const guideUrl = (slug: string) => `/guides/${slug}/`;
