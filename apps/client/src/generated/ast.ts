// Template for generated AST module
export const ast = {
  "type": "api",
  "name": "User",
  "children": [
    {
      "type": "operation",
      "name": "user",
      "constraints": {
        "request": "UserInput",
        "response": "User"
      },
      "request": "UserInput",
      "response": "User",
      "children": [
        {
          "type": "object",
          "name": "UserInput",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            }
          ]
        },
        {
          "type": "object",
          "name": "User",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            },
            {
              "type": "field",
              "name": "name",
              "children": [
                {
                  "type": "string",
                  "name": "name"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "operation",
      "name": "listUsers",
      "constraints": {
        "request": "ListUsersInput",
        "response": "UserList"
      },
      "request": "ListUsersInput",
      "response": "UserList",
      "children": [
        {
          "type": "object",
          "name": "ListUsersInput",
          "children": []
        },
        {
          "type": "array",
          "name": "UserList",
          "children": [
            {
              "type": "object",
              "name": "User",
              "children": [
                {
                  "type": "field",
                  "name": "_id",
                  "children": [
                    {
                      "type": "string",
                      "name": "_id"
                    }
                  ]
                },
                {
                  "type": "field",
                  "name": "name",
                  "children": [
                    {
                      "type": "string",
                      "name": "name"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "operation",
      "name": "joinChat",
      "constraints": {
        "publish": [
          "onUserJoined"
        ],
        "request": "UserInput",
        "response": "User"
      },
      "request": "UserInput",
      "response": "User",
      "children": [
        {
          "type": "object",
          "name": "UserInput",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            }
          ]
        },
        {
          "type": "object",
          "name": "User",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            },
            {
              "type": "field",
              "name": "name",
              "children": [
                {
                  "type": "string",
                  "name": "name"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "operation",
      "name": "leaveChat",
      "constraints": {
        "publish": [
          "onUserLeft"
        ],
        "request": "UserInput",
        "response": "User"
      },
      "request": "UserInput",
      "response": "User",
      "children": [
        {
          "type": "object",
          "name": "UserInput",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            }
          ]
        },
        {
          "type": "object",
          "name": "User",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            },
            {
              "type": "field",
              "name": "name",
              "children": [
                {
                  "type": "string",
                  "name": "name"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "operation",
      "name": "hello",
      "constraints": {
        "publish": [
          "onHello"
        ],
        "request": "HelloInput",
        "response": "Hello"
      },
      "request": "HelloInput",
      "response": "Hello",
      "children": [
        {
          "type": "object",
          "name": "HelloInput",
          "children": [
            {
              "type": "field",
              "name": "userId",
              "children": [
                {
                  "type": "string",
                  "name": "helloUserId"
                }
              ]
            }
          ]
        },
        {
          "type": "object",
          "name": "Hello",
          "children": [
            {
              "type": "field",
              "name": "userId",
              "children": [
                {
                  "type": "string",
                  "name": "helloUserId"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "operation",
      "name": "sendMessage",
      "constraints": {
        "publish": [
          "onMessage"
        ],
        "ack": {
          "required": true,
          "mode": "received",
          "timeoutMs": 5000,
          "retries": 3
        },
        "request": "SendMessageInput",
        "response": "Message"
      },
      "request": "SendMessageInput",
      "response": "Message",
      "children": [
        {
          "type": "object",
          "name": "SendMessageInput",
          "children": [
            {
              "type": "field",
              "name": "author",
              "children": [
                {
                  "type": "string",
                  "name": "author"
                }
              ]
            },
            {
              "type": "field",
              "name": "text",
              "children": [
                {
                  "type": "string",
                  "name": "text"
                }
              ]
            },
            {
              "type": "field",
              "name": "roomId",
              "children": [
                {
                  "type": "string",
                  "name": "roomId"
                }
              ]
            }
          ]
        },
        {
          "type": "object",
          "name": "Message",
          "children": [
            {
              "type": "field",
              "name": "id",
              "children": [
                {
                  "type": "string",
                  "name": "messageId"
                }
              ]
            },
            {
              "type": "field",
              "name": "author",
              "children": [
                {
                  "type": "string",
                  "name": "author"
                }
              ]
            },
            {
              "type": "field",
              "name": "text",
              "children": [
                {
                  "type": "string",
                  "name": "text"
                }
              ]
            },
            {
              "type": "field",
              "name": "createdAt",
              "children": [
                {
                  "type": "date",
                  "name": "createdAt"
                }
              ]
            },
            {
              "type": "field",
              "name": "roomId",
              "children": [
                {
                  "type": "string",
                  "name": "roomId"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "subscription",
      "name": "onUserJoined",
      "constraints": {
        "input": "UserInput",
        "payload": "User",
        "output": "User"
      },
      "request": "UserInput",
      "response": "User",
      "children": [
        {
          "type": "object",
          "name": "User",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            },
            {
              "type": "field",
              "name": "name",
              "children": [
                {
                  "type": "string",
                  "name": "name"
                }
              ]
            }
          ]
        },
        {
          "type": "object",
          "name": "UserInput",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            }
          ]
        },
        {
          "type": "object",
          "name": "User",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            },
            {
              "type": "field",
              "name": "name",
              "children": [
                {
                  "type": "string",
                  "name": "name"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "subscription",
      "name": "onUserLeft",
      "constraints": {
        "input": "UserInput",
        "payload": "User",
        "output": "User"
      },
      "request": "UserInput",
      "response": "User",
      "children": [
        {
          "type": "object",
          "name": "User",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            },
            {
              "type": "field",
              "name": "name",
              "children": [
                {
                  "type": "string",
                  "name": "name"
                }
              ]
            }
          ]
        },
        {
          "type": "object",
          "name": "UserInput",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            }
          ]
        },
        {
          "type": "object",
          "name": "User",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            },
            {
              "type": "field",
              "name": "name",
              "children": [
                {
                  "type": "string",
                  "name": "name"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "subscription",
      "name": "onHello",
      "constraints": {
        "input": "HelloInput",
        "payload": "Hello",
        "output": "Hello"
      },
      "request": "HelloInput",
      "response": "Hello",
      "children": [
        {
          "type": "object",
          "name": "Hello",
          "children": [
            {
              "type": "field",
              "name": "userId",
              "children": [
                {
                  "type": "string",
                  "name": "helloUserId"
                }
              ]
            }
          ]
        },
        {
          "type": "object",
          "name": "HelloInput",
          "children": [
            {
              "type": "field",
              "name": "userId",
              "children": [
                {
                  "type": "string",
                  "name": "helloUserId"
                }
              ]
            }
          ]
        },
        {
          "type": "object",
          "name": "Hello",
          "children": [
            {
              "type": "field",
              "name": "userId",
              "children": [
                {
                  "type": "string",
                  "name": "helloUserId"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "subscription",
      "name": "onMessage",
      "constraints": {
        "input": "SendMessageInput",
        "payload": "Message",
        "output": "Message"
      },
      "request": "SendMessageInput",
      "response": "Message",
      "children": [
        {
          "type": "object",
          "name": "Message",
          "children": [
            {
              "type": "field",
              "name": "id",
              "children": [
                {
                  "type": "string",
                  "name": "messageId"
                }
              ]
            },
            {
              "type": "field",
              "name": "author",
              "children": [
                {
                  "type": "string",
                  "name": "author"
                }
              ]
            },
            {
              "type": "field",
              "name": "text",
              "children": [
                {
                  "type": "string",
                  "name": "text"
                }
              ]
            },
            {
              "type": "field",
              "name": "createdAt",
              "children": [
                {
                  "type": "date",
                  "name": "createdAt"
                }
              ]
            },
            {
              "type": "field",
              "name": "roomId",
              "children": [
                {
                  "type": "string",
                  "name": "roomId"
                }
              ]
            }
          ]
        },
        {
          "type": "object",
          "name": "SendMessageInput",
          "children": [
            {
              "type": "field",
              "name": "author",
              "children": [
                {
                  "type": "string",
                  "name": "author"
                }
              ]
            },
            {
              "type": "field",
              "name": "text",
              "children": [
                {
                  "type": "string",
                  "name": "text"
                }
              ]
            },
            {
              "type": "field",
              "name": "roomId",
              "children": [
                {
                  "type": "string",
                  "name": "roomId"
                }
              ]
            }
          ]
        },
        {
          "type": "object",
          "name": "Message",
          "children": [
            {
              "type": "field",
              "name": "id",
              "children": [
                {
                  "type": "string",
                  "name": "messageId"
                }
              ]
            },
            {
              "type": "field",
              "name": "author",
              "children": [
                {
                  "type": "string",
                  "name": "author"
                }
              ]
            },
            {
              "type": "field",
              "name": "text",
              "children": [
                {
                  "type": "string",
                  "name": "text"
                }
              ]
            },
            {
              "type": "field",
              "name": "createdAt",
              "children": [
                {
                  "type": "date",
                  "name": "createdAt"
                }
              ]
            },
            {
              "type": "field",
              "name": "roomId",
              "children": [
                {
                  "type": "string",
                  "name": "roomId"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "type": "field",
      "name": "User.greeting",
      "constraints": {
        "owner": "User",
        "field": "greeting",
        "response": "greeting",
        "dependsOn": "User"
      },
      "response": "greeting",
      "dependsOn": "User",
      "children": [
        {
          "type": "object",
          "name": "User",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            },
            {
              "type": "field",
              "name": "name",
              "children": [
                {
                  "type": "string",
                  "name": "name"
                }
              ]
            }
          ]
        },
        {
          "type": "string",
          "name": "greeting"
        }
      ]
    },
    {
      "type": "field",
      "name": "User.friends",
      "constraints": {
        "owner": "User",
        "field": "friends",
        "response": "UserList",
        "dependsOn": "User"
      },
      "response": "UserList",
      "dependsOn": "User",
      "children": [
        {
          "type": "object",
          "name": "User",
          "children": [
            {
              "type": "field",
              "name": "_id",
              "children": [
                {
                  "type": "string",
                  "name": "_id"
                }
              ]
            },
            {
              "type": "field",
              "name": "name",
              "children": [
                {
                  "type": "string",
                  "name": "name"
                }
              ]
            }
          ]
        },
        {
          "type": "array",
          "name": "UserList",
          "children": [
            {
              "type": "object",
              "name": "User",
              "children": [
                {
                  "type": "field",
                  "name": "_id",
                  "children": [
                    {
                      "type": "string",
                      "name": "_id"
                    }
                  ]
                },
                {
                  "type": "field",
                  "name": "name",
                  "children": [
                    {
                      "type": "string",
                      "name": "name"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
} as const;

export default ast;
