export const getAllUserSockets = (instance, userId) => {
    const userConnections = instance.config.connectionMap.get(userId);
    if (!userConnections) return [];

    return Array.from(userConnections.values()); // all ws
};