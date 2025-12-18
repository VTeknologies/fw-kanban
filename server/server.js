exports = {
  // args is a JSON block containing the payload information.
  // args['iparam'] will contain the installation parameter values.

  appInstallCallback: function (args) {
    console.info("onAppInstallHandler invoked with following data: \n", args);
    renderData();
  },
  serverMethod: async function (args) {
    try {
      // console.info("serverMethod invoked with following data: \n", args);
      console.log(args);

      let data;
      if (args.type === "getAllTickets") {
        data = await fetchAllTickets(args);
      } else if (args.type === "loadMoreTickets") {
        data = await fetchTickets(args.value, args.index, args.pages, args);
      } else if (args.type === "updateTicket") {
        data = await updateTicket(args.ticketId, args.body, args);
      }
      renderData(null, {
        message: "Server method executed successfully!",
        response: data,
      });
    } catch (error) {
      console.error(error);
    }
  },
};

const fetchAllTickets = async (args) => {
  try {
    let pages = {};
    let hasMore = {};
    let allTickets = [];
    let errors = {};
    if (args.ticketFields && args.ticketFields.length > 0) {
      for (const [index, element] of args.ticketFields.entries()) {
        try {
          if (element.showInBoard) {
            pages[index] = 1;
            const { tickets, error, message } = await fetchTickets(
              element.value,
              index,
              pages,
              args
            );
            if (!error) {
              allTickets.push(getTickets(tickets.results, element.value, args));
              if (allTickets[index].length < tickets.total) {
                hasMore[index] = true;
                pages[index]++;
              } else if (allTickets[index]?.length === tickets.total)
                hasMore[index] = false;
              // this.disableScroll[index] = true;
              // this.storeInsessionStorage();
              // this.ticketBak = this.tickets;
            } else {
              errors = { error, message };
            }
            // this.closeLoading(element.key);
          }
        } catch (error) {
          console.error(error);
        }

        // this.disablePagination = false;
      }
      return { allTickets, pages, hasMore, errors };
    }
  } catch (error) {
    console.error("Error fetching tickets: ", error);
    throw error;
  }
};

const fetchTickets = async (value, index, pages, args) => {
  try {
    const pageOptions = `&page=${pages[index]}`;
    const renamedField =
      args.ticketFieldName === "responder_id"
        ? "agent_id"
        : args.ticketFieldName === "group"
        ? "group_id"
        : args.ticketFieldName;
    const defaultFilter =
      args.defaultFilter !== "" ? ` AND ${args.defaultFilter}` : "";
    // Filter for custom field ad type will be string, so checking and adding the same
    const isString =
      args.ticketFieldName.startsWith("cf_") || args.ticketFieldName === "type";
    const filter = encodeURI(
      `query="${renamedField}:${
        value !== "Unassigned" ? (isString ? `'${value}'` : value) : null
      }${defaultFilter}"`
    );
    // console.log(filter);
    // console.log(args.iparams);

    const { response, status, headers } = await $request.invokeTemplate(
      "getAllTickets",
      {
        context: {
          filter: filter + pageOptions,
          apiKey: args.iparams.credentials[args.loggedInUser],
        },
      }
    );
    if (status === 200) {
      const tickets = JSON.parse(response);
      return {
        tickets,
        headers,
        error: false,
      };
    }
  } catch (error) {
    console.error(error.response || error);
    if (error.status == 400 || error.status == 404) {
      return {
        message: "Invalid API Key / Domain Name / Something went wrong",
        error: true,
      };
    } else if (error.status == 429) {
      return {
        message: "Too many requests. Please try again later.",
        error: true,
      };
    } else {
      return {
        message: "Something went wrong. Please try again.",
        error: true,
      };
    }
  }
};

const getTickets = (tickets, value, args) => {
  const ticketData = tickets.filter((element) => {
    let ticket = args.ticketFieldName.startsWith("cf_")
      ? element.custom_fields
      : element;
    if (value === "Unassigned") {
      return ticket[args.ticketFieldName] === null;
    } else {
      return ticket[args.ticketFieldName] === Number(value)
        ? Number(value)
        : value;
    }
  });
  return ticketData;
};

const updateTicket = async (ticketId, body, args) => {
  try {
    const { response, status } = await $request.invokeTemplate("updateTicket", {
      context: {
        ticketId,
        apiKey: args.iparams.credentials[args.loggedInUser],
      },
      body: JSON.stringify(body),
    });
    if (status === 200) {
      const ticket = JSON.parse(response);
      return {
        ticket,
        error: false,
      };
    } else throw new Error("Failed to update ticket");
  } catch (error) {
    console.error(error.response || error);
    if (error.status == 400 || error.status == 404) {
      return {
        message: "Invalid API Key / Domain Name / Something went wrong",
        error: true,
      };
    } else if (error.status == 429) {
      return {
        message: "Too many requests. Please try again later.",
        error: true,
      };
    } else {
      return {
        message: "Something went wrong. Please try again.",
        error: true,
      };
    }
  }
};
