# **App Name**: DENIMLAB

## Core Features:

- User Authentication: Secure login system with email and password using Firebase Authentication. Users are redirected to the dashboard upon successful login.
- Role-Based Access Control: User roles (ADMIN, BODEGA, PRODUCCION, etc.) are stored in Firestore, enabling route protection and module visibility based on the assigned role.
- Client Management: Basic management of clients, allowing for creation, viewing, and updating of client details (id, name, RUC, phone, address). Data stored in Firestore.
- Garment Entry (Ingresos) Management: Functionality to record new batches of garments arriving, linked to a specific client. Includes entry details like entryNumber, entryDate, and totalGarments.
- AI-Powered Garment Description Tool: A tool that uses generative AI to help standardize and describe garment conditions based on basic user observations, improving consistency in inventory data.
- Main Navigation System: A persistent navigation menu providing access to key sections: Dashboard, Clientes, Ingresos, Salidas, Facturación, Cobranzas, and Configuración.
- Basic Dashboard View: A simple dashboard displaying a welcome message along with the currently logged-in user's name and assigned role.

## Style Guidelines:

- The palette is designed for a professional and modern industrial context. Primary color: a muted, deep blue-grey (#50667A) to evoke stability and a clean, technical feel. This color ensures good contrast against lighter elements for readability.
- Background color: A very light, desaturated blue-grey (#EFF2F4), providing a clean, airy canvas that is visually cohesive with the primary color and supports extended use without eye strain.
- Accent color: A deep purple-blue (#5C6CDA) chosen to be analogous to the primary color while providing distinct contrast for interactive elements, highlights, and calls to action.
- Body and headline font: 'Inter' (sans-serif) for its modern, highly legible, and neutral design, ensuring clarity and professionalism across all text content.
- Utilize clean, functional, and simple line icons that clearly represent their respective actions or categories, maintaining a professional and intuitive user experience.
- Implement a clear, hierarchical layout with a primary persistent navigation (either sidebar or top-bar) and distinct content areas for each module, ensuring responsiveness for various screen sizes.
- Incorporate subtle and swift animations for navigation transitions, form submissions, and data updates to provide visual feedback and enhance the overall user experience without being distracting.