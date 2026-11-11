import { Listing, EscrowOrder, DisputeCase, UserProfile, UserRole } from '../types';

export const mockListings: Listing[] = [];

export const mockOrders: EscrowOrder[] = [];

export const mockDisputes: DisputeCase[] = [];

export const mockUsersByRole: Partial<Record<UserRole, UserProfile>> = {};
