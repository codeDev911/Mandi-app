import { VendorLot, AppSettings, CustomerBuyer, SavedVendor, ShopExpense } from '../types';
import { calculateLotSummary } from './calculations';

export const defaultSettings: AppSettings = {
  language: 'en',
  currencySymbol: 'Rs.',
  defaultCommissionPercent: 6.0,
  defaultMazdooriPerUnit: 30,
  unitMazdooriRates: {
    bori: 30,     // Bori: Rs. 30
    tora: 25,     // Tora: Rs. 25
    kainchi: 20,  // Kainchi: Rs. 20
    shopper: 15,  // Shopper: Rs. 15
    crates: 20,   // Crate: Rs. 20
    peti: 25,     // Peti: Rs. 25
    theli: 15,    // Theli: Rs. 15
    kg: 2,        // Kg: Rs. 2
    nag: 5,       // Piece: Rs. 5
  },
  defaultMarketFeePerUnit: 5,
  defaultMunshiana: 30,
  shopNameUrdu: 'Bismillah Fruit & Vegetable Commission Shop',
  shopNameEn: 'Bismillah Fruit & Vegetable Commission Shop',
  shopAddressUrdu: 'Shop #32, Block A, New Sabzi Mandi, Lahore',
  shopAddressEn: 'Shop #32, Block A, New Sabzi Mandi, Lahore',
  shopPhone: '+92 300 1234567',
  arhtiNameUrdu: 'Haji Muhammad Rafeeq (Arhti)',
  arhtiNameEn: 'Haji Muhammad Rafeeq (Arhti)',
  soundEnabled: true,
  viewMode: 'mobile',
};

export const sampleVendors: SavedVendor[] = [];

export const sampleCustomers: CustomerBuyer[] = [];

export const sampleLots: VendorLot[] = [];

export const sampleExpenses: ShopExpense[] = [];

// Initialize lots with dynamic calculation
export function getInitialLots(): VendorLot[] {
  return [];
}
