import type { Response } from "express";

// Array to store all connected users (browsers)
let clients: Response[] = [];

export const addClient = (res: Response) => {
  clients.push(res);
};

export const removeClient = (res: Response) => {
  clients = clients.filter((client) => client !== res);
};

// Function to send a message to everyone
export const broadcast = (event: string, data: any) => {
  clients.forEach((client) => {
    client.write(`event: ${event}\n`);
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};
