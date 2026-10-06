/** Namespace `resto` — Digital canteen page. */
export default {
  title: 'Digital canteen',
  subtitle:
    'No more paper tickets: the counter scans the student card, validates the meal in two seconds — zero cash, zero fraud.',
  cantine: 'Canteen',
  actions: {
    creditWallet: 'Top up a wallet',
  },
  rechargeDialog: {
    title: 'Top up a canteen wallet',
    student: 'Student *',
    noWallet: 'No wallet found',
    sectionTitle: 'Top-up',
    amount: 'Amount (GNF) *',
    mode: 'Payment method *',
    confirmImmediately: 'Confirm immediately (pilot simulation)',
    mobileMoneyNote:
      'With Mobile Money, the top-up stays pending until it is confirmed through the payment module (simulation) and credited to the wallet.',
    cashNote: 'Cash at the counter: the wallet is credited immediately.',
    messages: {
      credited: 'Wallet credited: {balance} GNF',
      pending: 'Top-up awaiting confirmation ({reference})',
    },
  },
  tabs: {
    guichet: 'Counter',
    wallets: 'Wallets',
    transactions: 'Transactions',
  },
  guichet: {
    header: 'Validation counter',
    onlineNote: 'online — balance is checked on the server',
    studentLabel: 'Student card (QR, ID number, or phone)',
    studentHint: "Scan the diner's card or enter their ID number",
    mealLabel: 'Meal *',
    mealFree: 'free',
    priceLabel: 'Price (GNF)',
    cantinePlaceholder: 'Main',
    validate: 'Validate meal',
    result: {
      ok: {
        title: 'Meal validated',
        newBalance: 'New balance',
      },
      ko: {
        title: 'Meal declined',
        rechargeWallet: 'Top up wallet',
        networkError: 'Network error: check the counter station connection',
      },
      empty: {
        message: 'Scan the card or enter the ID number, choose the meal, then validate: the outcome will show here.',
      },
    },
  },
  wallets: {
    searchPlaceholder: 'Search (ID number, last name, first name…)',
    table: {
      columns: {
        student: 'Student',
        phone: 'Phone',
        balance: 'Balance',
      },
    },
    actions: {
      recharge: 'Top up',
    },
    emptyState: {
      title: 'No wallet matches this search.',
      description: 'A wallet is created on the first top-up: credit one to open a student’s canteen account.',
    },
    chips: {
      search: '"{search}"',
    },
  },
  transactions: {
    tabs: {
      recharges: 'Top-ups',
      consommations: 'Meals',
    },
    filters: {
      from: 'From',
      to: 'To',
      paymentStatus: 'Payment status',
    },
    actions: {
      today: 'Today',
      refresh: 'Refresh the list',
      refundAria: 'Refund this meal',
    },
    kpi: {
      credited: 'Collected: {amount} GNF',
      debited: 'Spent: {amount} GNF',
      netPositive: 'Net positive: {amount} GNF',
      netNegative: 'Net negative: {amount} GNF',
    },
    table: {
      columns: {
        date: 'Date',
        type: 'Operation',
        student: 'Student',
        detail: 'Detail',
        amount: 'Amount',
        status: 'Status',
      },
    },
    type: {
      meal: 'Meal',
      recharge: 'Top-up',
    },
    typeLabel: {
      recharges: 'top-up',
      consommations: 'meal',
    },
    emptyState: {
      title: 'No {type} in this period.',
      description: 'The period runs from {from} to {to} — widen it to see further back.',
    },
    confirmRefund: {
      title: 'Refund this meal?',
      message: '{meal} — {amount} GNF will be credited back to the student’s wallet.',
      confirm: 'Refund',
    },
    messages: {
      refunded: 'Meal cancelled — balance refunded',
    },
    chips: {
      cantine: 'Canteen: {cantine}',
    },
    paymentModeFallback: 'Payment',
  },
};
