const categories = [
    { id: 'all', name: 'All' },
    { id: 'pizza', name: 'Pizza' },
    { id: 'burger', name: 'Burger' },
    { id: 'salad', name: 'Salads' },
    { id: 'drink', name: 'Drinks' },
    { id: 'dessert', name: 'Desserts' }
];

const foodItems = [
    {
        id: 1,
        name: 'Classic Cheeseburger',
        price: 8.99,
        category: 'burger',
        image: 'images/burger.png',
        description: 'Juicy beef patty with cheddar cheese, lettuce, tomato, and our secret sauce.'
    },
    {
        id: 2,
        name: 'Pepperoni Supreme',
        price: 12.99,
        category: 'pizza',
        image: 'images/pizza.png',
        description: 'Loaded with pepperoni, mozarella, and italian seasoning on a crispy crust.'
    },
    {
        id: 3,
        name: 'Caesar Salad',
        price: 9.50,
        category: 'salad',
        image: 'images/salad.png',
        description: 'Fresh romaine lettuce, croutons, parmesan cheese, and creamy caesar dressing.'
    },
    {
        id: 4,
        name: 'Double Bacon Burger',
        price: 11.99,
        category: 'burger',
        image: 'images/burger.png',
        description: 'Two beef patties, crispy bacon, and melted cheese.'
    },
    {
        id: 5,
        name: 'Margherita Pizza',
        price: 10.99,
        category: 'pizza',
        image: 'images/pizza.png',
        description: 'Fresh basil, tomatoes, and mozzarella cheese.'
    },
    {
        id: 6,
        name: 'Greek Salad',
        price: 8.99,
        category: 'salad',
        image: 'images/salad.png',
        description: 'Cucumbers, tomatoes, olives, onions, and feta cheese.'
    },
     {
        id: 7,
        name: 'Cola Zero',
        price: 1.99,
        category: 'drink',
        image: 'https://via.placeholder.com/300x200?text=Cola', // Placeholder
        description: 'Refreshing sugar-free cola.'
    },
    {
        id: 8,
        name: 'Chocolate Brownie',
        price: 4.99,
        category: 'dessert',
        image: 'https://via.placeholder.com/300x200?text=Brownie', // Placeholder
        description: 'Rich chocolate brownie with vanilla ice cream.'
    }
];
