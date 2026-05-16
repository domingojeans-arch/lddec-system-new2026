import { Client } from "@/types/client";

const MOCK_DATE = "2024-03-20T10:00:00Z";

export const mockClients: Client[] = [
  {
    id: "1",
    firstName: "JUAN",
    lastName: "PEREZ",
    name: "JUAN PEREZ",
    classification: "socio",
    idNumber: "2010405060101",
    noId: false,
    baseDebt: 1500.00,
    openingDate: "2024-01-01",
    phone: "987654321",
    email: "logistica@textilpacifico.pe",
    address: "Av. Industrial 123, Lima",
    status: "active",
    createdAt: MOCK_DATE,
    updatedAt: MOCK_DATE,
    createdBy: "admin"
  },
  {
    id: "2",
    firstName: "MARIA",
    lastName: "GARCIA",
    name: "MARIA GARCIA",
    classification: "nacional",
    idNumber: "2050102030102",
    noId: false,
    baseDebt: 0,
    openingDate: "2024-02-15",
    phone: "912345678",
    email: "compras@denimworld.com",
    address: "Calle Los Talleres 456, Ate",
    status: "active",
    createdAt: MOCK_DATE,
    updatedAt: MOCK_DATE,
    createdBy: "admin"
  }
];
