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
  third_party_id?: string;
  third_party_name?: string;
  type: string;
  is_base: boolean;
}

export interface ChartData {
  day: string;
  total: number;
}

export interface ThirdParty {
  id: string;
  name: string;
}
