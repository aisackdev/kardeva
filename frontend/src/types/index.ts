export interface DbStatusResponse {
  message: string;
  serverTime: string;
}

export interface Transaction {
  id: string;
  merchant: string;
  location: string;
  date: string;
  card_type: string;
  auth_code: string;
  amount: string;
  is_third_party: boolean;
}
