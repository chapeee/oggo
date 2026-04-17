# API Reference

Oggo exposes a REST API used internally by the frontend. 

*Note: These endpoints are internal and subject to change without notice. They are not intended for public external consumption.*

## Servers

### `GET /api/servers`
Returns a list of all configured servers.

### `POST /api/servers`
Create a new server configuration.

### `PUT /api/servers/:id`
Update an existing server. Does not overwrite passwords if the password field is left empty.

### `DELETE /api/servers/:id`
Delete a server and its associated jobs.

## Jobs

### `GET /api/jobs`
List all jobs.

### `POST /api/jobs`
Create a new cron job.

### `POST /api/jobs/:id/run`
Trigger a manual run of a specific job.

## Terminal Intelligence

### `GET /api/terminal/suggest?q=...&server_id=...`
Returns a list of suggested commands based on history and `tldr` cache.

### `GET /api/terminal/command/:name`
Returns detailed explanation and examples for a specific command.
