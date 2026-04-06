/**
 * ApiResponse — Standardises every successful JSON reply.
 *
 * Every response follows the shape:
 *   { success: true, message: "...", data: ... }
 *
 * Using static methods keeps controllers thin:
 *   ApiResponse.ok(res, "Fetched user", user);
 */
class ApiResponse {
  /**
   * 200 OK — Generic success response.
   * @param {import("express").Response} res
   * @param {string} message
   * @param {*} data - Payload (optional)
   */
  static ok(res, message, data = null) {
    return res.status(200).json({
      success: true,
      message,
      data,
    });
  }

  /**
   * 201 Created — A new resource was successfully created.
   */
  static created(res, message, data = null) {
    return res.status(201).json({
      success: true,
      message,
      data,
    });
  }

  /**
   * 204 No Content — Success with no body (e.g. DELETE).
   */
  static noContent(res) {
    return res.status(204).send();
  }
}

export default ApiResponse;