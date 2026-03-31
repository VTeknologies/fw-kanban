(function () {
  new Vue({
    el: "#kabanaId",
    components: {},
    data: {
      isDragging: false,
      onlyMyIssues: false,
      recentlyUpdated: false,
      fdObject: null,
      ticketFieldName: "",
      ticketFields: [],
      allTicketFields: [],
      dropdownFields: [],
      statusOptions: [],
      tickets: [],
      ticketBak: [],
      loading: {},
      loggedInUser: null,
      agentsList: [],
      groupsList: [],
      dbData: {},
      canAddMoreFields: false,
      showMoreFilters: false,
      priorityList: [
        {
          id: 1,
          name: "Low",
          color: "#a0d76a",
        },
        {
          id: 2,
          name: "Medium",
          color: "#4da1ff",
        },
        {
          id: 3,
          name: "High",
          color: "#ffd012",
        },
        {
          id: 4,
          name: "Urgent",
          color: "#ff5959",
        },
      ],
      filters: {
        defaultFields: [
          { name: "agent", label: "Agent" },
          { name: "group", label: "Group" },
          { name: "priority", label: "Priority" },
        ],
      },
      selectedAgents: [],
      selectedGroups: [],
      selectedPriority: null,
      defaultFilter: "",
      hasFilter: false,
      searchInput: "",
      hasAccess: true,
      isApiAccessEnabled: false,
      pages: {},
      hasMore: {},
      isLoadingMore: {},
      sortBy: {
        field: "",
        order: "",
      },
      // debouncedLoadMore: null,
      iparams: {},
      groupBy: null,
    },
    watch: {
      hasFilter() {
        if (!this.hasFilter) {
          this.onlyMyIssues = false;
          this.recentlyUpdated = false;
        }
      },

      searchInput() {
        if (this.searchInput.length > 0) {
          this.tickets = [];
          this.ticketBak.forEach((elm) => {
            let tickt = elm.filter((elms) => {
              return (
                elms.subject
                  .toLowerCase()
                  .indexOf(this.searchInput.toLowerCase()) !== -1 ||
                elms.description_text
                  .toLowerCase()
                  .indexOf(this.searchInput.toLowerCase()) !== -1 ||
                elms.id == this.searchInput
              );
            });
            this.tickets.push(tickt);
          });
        } else {
          this.tickets = this.ticketBak;
        }
      },
    },

    created() {
      this.initFD();
    },
    // mounted() {
    //   this.debouncedLoadMore = this.debounce(this.loadMoreWrapper, 300);
    // },
    methods: {
      async initFD() {
        try {
          const client = await app.initialized();
          this.fdObject = client;

          const data = await this.fdObject.data.get("loggedInUser");
          this.$refs.kanbanContainder.classList.remove("hide");
          this.loggedInUser = data.loggedInUser.id;

          await this.getIparams();
          if (!this.hasAccess) return;

          this.getAgentList();
          this.getDataFromModel();
          this.getTicketFields();
        } catch (error) {
          console.error(error);
          this.showNotify(
            { message: error.response || "Failed to initialize app" },
            "danger",
          );
        }
      },

      async getIparams() {
        try {
          const data = await this.fdObject.iparams.get();
          this.iparams = data;
          this.isApiAccessEnabled = data.enable_api_key_access;
          if (this.isApiAccessEnabled)
            this.hasAccess = data.agent_ids.includes(this.loggedInUser);
          else this.hasAccess = true;
        } catch (error) {
          console.error(error);
        }
      },
      showLoading(containerId) {
        if (
          this.loading[containerId] === null ||
          !this.loading[containerId]?.visible
        ) {
          this.loading[containerId] = this.$loading({
            lock: false,
            fullscreen: false,
            background: "#c0c0c021",
            target: document.querySelector(`[data-key="${containerId}"]`),
            text: "Loading",
          });
        }
      },

      closeLoading(id) {
        this.loading?.[id]?.close?.();
        this.loading[id] = null;
        // if (this.loading[containerId] !== null) {
        //   this.loading[containerId].close();
        // }
      },

      openSettings() {
        this.fdObject.interface.trigger("showModal", {
          title: "Configurations",
          template: "settings.html",
          data: {
            loggedInUser: this.loggedInUser,
          },
        });
      },

      getSelectedTicketFields() {
        return this.fdObject.db.get("ticket-fields-" + this.loggedInUser);
      },

      async getTicketFieldsOptions() {
        try {
          const data = await this.getSelectedTicketFields();
          this.dbData = data.field_data ? { ...data } : { field_data: [data] };
          const { group, field_data, filter } = this.dbData;

          let fieldObj = group
            ? field_data.find((x) => x.selectedTicketField === group)
            : field_data[0];
          if (group) {
            this.groupBy = `${group},${fieldObj.selectedChoiceId}`;
          }
          this.ticketFieldName = fieldObj.selectedTicketField;

          // Backward compatibility check → throws intentionally
          if (["source", "product_id"].includes(this.ticketFieldName)) {
            throw { status: 404 };
          }

          // Build ticketFields with visibility property
          const selectedChoice =
            fieldObj.selectedChoice?.map((elm) => ({
              ...elm,
              showInBoard: true,
            })) || [];

          const hiddenChoice =
            fieldObj.hiddenChoice?.map((elm) => ({
              ...elm,
              showInBoard: false,
            })) || [];

          this.ticketFields = [...selectedChoice, ...hiddenChoice];

          const hasAnyFilter = Object.keys(filter || {}).some(
            (key) => key !== "defaultFields" && filter[key]?.length > 0,
          );
          this.filters =
            Object.keys(filter).length > 0 ? { ...filter } : this.filters;
          if (this.hasFilter) {
            this.handleOnlyMyTickets();
          } else if (hasAnyFilter) {
            this._filterSelectedAgents(undefined, true);
            // this.buildFilters();
          } else {
            this.showAllLoading();
            this.getAllTickets();
          }
        } catch (err) {
          console.error(err);

          // Handle backward compatibility select → getStatusList
          if (err.status === 404) {
            try {
              const data = await this.fdObject.request.invokeTemplate(
                "getStatusList",
                {
                  context: { agentId: this.loggedInUser },
                },
              );

              if (data.status !== 200) throw data;

              const choice = JSON.parse(data.response)[0].choices;

              this.ticketFields = Object.keys(choice).map((key) => ({
                key: choice[key][0],
                value: key.toString(),
                showInBoard: true,
              }));

              this.ticketFieldName = "status";

              if (this.hasFilter) {
                this.handleOnlyMyTickets();
              } else {
                this.showAllLoading();
                this.getAllTickets();
              }
            } catch (error) {
              console.error(error);
              const isInvalidKey = error.status === 400 || error.status === 404;

              this.showNotify(
                {
                  message: isInvalidKey
                    ? "Invalid API Key / Domain Name"
                    : error.response,
                },
                "danger",
              );
            }
          }
        }
      },
      showAllLoading() {
        for (element of this.ticketFields) {
          if (element.showInBoard) {
            this.showLoading(element.key);
          }
        }
      },
      closeAllLoading() {
        for (element of this.ticketFields) {
          if (element.showInBoard) {
            this.closeLoading(element.key);
          }
        }
      },
      async getAllTickets() {
        try {
          this.searchInput = "";
          this.tickets = [];
          const { response } = await this.fdObject.request.invoke(
            "serverMethod",
            {
              type: "getAllTickets",
              loggedInUser: this.loggedInUser,
              ticketFields: this.ticketFields,
              ticketFieldName: this.ticketFieldName,
              defaultFilter: this.defaultFilter,
            },
          );
          if (response.response?.errors?.error) {
            this.showNotify(
              { message: response.response.errors.message },
              "danger",
            );

            return;
          }

          this.tickets = [...response.response.allTickets];
          this.ticketBak = [...response.response.allTickets];
          this.pages = response.response?.pages;
          this.hasMore = response.response?.hasMore;
        } catch (error) {
          console.error(error);
          this.showNotify({ message: "Failed to fetch tickets" }, "danger");
        } finally {
          this.closeAllLoading();
        }
      },
      // fetchTickets is never called client-side; all fetching goes through serverMethod
      // async fetchTickets(value, index) {
      //   try {
      //     const pageOptions = `&page=${this.pages[index]}`;
      //     const renamedField =
      //       this.ticketFieldName === "responder_id"
      //         ? "agent_id"
      //         : this.ticketFieldName;
      //     const defaultFilter =
      //       this.defaultFilter !== "" ? ` AND ${this.defaultFilter}` : "";
      //     // Filter for custom field ad type will be string, so checking and adding the same
      //     const isString =
      //       this.ticketFieldName.startsWith("cf_") ||
      //       this.ticketFieldName === "type";
      //     const filter = encodeURI(
      //       `query="${renamedField}:${
      //         value !== "Unassigned" ? (isString ? `'${value}'` : value) : null
      //       }${defaultFilter}"`,
      //     );
      //     const { response, status, headers } =
      //       await this.fdObject.request.invokeTemplate("getAllTickets", {
      //         context: {
      //           filter: filter + pageOptions,
      //           agentId: this.loggedInUser,
      //         },
      //       });
      //     if (status === 200) {
      //       const tickets = JSON.parse(response);
      //       return {
      //         tickets,
      //         headers,
      //         error: false,
      //       };
      //     }
      //   } catch (error) {
      //     console.error(error);
      //     if (error.status == 400 || error.status == 404) {
      //       this.showNotify(
      //         { message: "Invalid API Key / Domain Name" },
      //         "danger",
      //       );
      //     } else if (error.status == 429) {
      //       this.showNotify(
      //         { message: "Too many requests. Please try again later." },
      //         "danger",
      //       );
      //     } else {
      //       this.showNotify({ message: error.response }, "danger");
      //     }
      //     return {
      //       error: true,
      //     };
      //   }
      // },
      async getTicketFields() {
        try {
          const { response, status } =
            await this.fdObject.request.invokeTemplate("getTicketFields", {
              context: { agentId: this.loggedInUser },
            });
          if (status === 200) {
            const fieldTypes = [
              "default_priority",
              "default_group",
              "default_status",
              "default_ticket_type",
              "custom_dropdown",
              "default_agent",
            ];
            this.allTicketFields = JSON.parse(response);
            this.dropdownFields = this.allTicketFields.filter((x) =>
              fieldTypes.includes(x.type),
            );
          }
        } catch (error) {
          console.error(error);
        }
      },
      formatDate(date) {
        let day = date.getDate();
        let monthIndex = date.getMonth() + 1;
        const year = date.getFullYear();
        if (monthIndex <= 9) {
          monthIndex = "0" + monthIndex;
        }
        if (day <= 9) {
          day = "0" + day;
        }
        return year + "-" + monthIndex + "-" + day;
      },

      // getTickets(tickets, value) {  // unused: duplicate of server.js getTickets, never called client-side
      //   const ticketData = tickets.filter((element) => {
      //     let ticket = this.ticketFieldName.startsWith("cf_")
      //       ? element.custom_fields
      //       : element;
      //     if (value === "Unassigned") {
      //       return ticket[this.ticketFieldName] === null;
      //     } else {
      //       return ticket[this.ticketFieldName] === Number(value)
      //         ? Number(value)
      //         : value;
      //     }
      //   });
      //   return ticketData;
      // },
      handleTicketClicked(ticketId, subject, agentName, status) {
        this.fdObject.interface.trigger("showModal", {
          title: `#${ticketId} - ` + subject,
          template: "modal.html",
          data: {
            ticketId: ticketId,
            agentName: agentName,
            status: this.statusOptions[status][0],
            agentsList: this.agentsList,
            iparams: this.iparams,
            loggedInUser: this.loggedInUser,
          },
        });
      },

      getDataFromModel() {
        this.fdObject.instance.receive((event) => {
          const data = event.helper.getData();

          if (data.message.fromModel) {
            this.fdObject.interface.trigger("click", {
              id: "ticket",
              value: data.message.redirect,
            });
          } else {
            // Workaround to select only my issues default if it is already selected
            this.onlyMyIssues = false;

            this.getTicketFieldsOptions();
          }
        });
      },

      async getAgentList(currentPage = 1) {
        try {
          const { response, status, headers } =
            await this.fdObject.request.invokeTemplate("getAgents", {
              context: {
                page: currentPage,
                agentId: this.loggedInUser,
              },
            });
          if (status === 200) {
            const resp = JSON.parse(response);
            this.agentsList = [...this.agentsList, ...resp];
            // If there's a next page, fetch recursively

            if (headers.link && resp.length) {
              await this.getAgentList(++currentPage);
            } else {
              // Once all agents are fetched, get other data
              this.getStatusList();
              this.hasFilter = false;
              this.getTicketFieldsOptions();
              this.getGroupList();
            }
          } else {
            throw data;
          }
        } catch (error) {
          console.error(error);
          if (error.status === 400 || error.status === 404) {
            this.showNotify(
              { message: "Invalid API Key / Domain Name" },
              "danger",
            );
          } else {
            this.showNotify({ message: error.response }, "danger");
          }
        }
      },

      getAgentNameFromList(agentId) {
        let agentName = this.agentsList.filter((elm) => elm.id == agentId);
        try {
          return agentName[0].contact.name;
        } catch (e) {
          console.error(e);

          return " ";
        }
      },

      getGroupList() {
        this.fdObject.request
          .invokeTemplate("getGroupList", {
            context: { agentId: this.loggedInUser },
          })
          .then((data) => {
            if (data.status == 200) {
              const keyValue = [];
              const response = JSON.parse(data.response)[0];
              for (let key in response.choices) {
                keyValue.push({
                  id: response.choices[key],
                  name: key,
                });
              }
              this.groupsList = keyValue;
            } else {
              throw data;
            }
          })
          .catch((error) => {
            console.error(error);
            if (error.status == 400 || error.status == 404) {
              this.showNotify(
                { message: "Invalid API Key / Domain Name" },
                "danger",
              );
            } else {
              this.showNotify({ message: error.response }, "danger");
            }
          });
      },

      getStatusList() {
        this.fdObject.request
          .invokeTemplate("getStatusList", {
            context: {
              agentId: this.loggedInUser,
            },
          })
          .then((data) => {
            if (data.status == 200) {
              this.statusOptions = JSON.parse(data.response)[0].choices;
            }
          })
          .catch((error) => {
            console.error(error);
            if (error.status == 400 || error.status == 404) {
              this.showNotify(
                { message: "Invalid API Key / Domain Name" },
                "danger",
              );
            } else {
              this.showNotify({ message: error.response }, "danger");
            }
          });
      },

      handleTicketDragEnd(evt) {
        const id = evt.item._underlying_vm_.id;
        const status =
          this.ticketFieldName.startsWith("cf_") ||
          this.ticketFieldName == "type"
            ? evt.target.id
            : parseInt(evt.target.id);
        this.changeTicketFieldStatus(id, status);
      },

      showNotify(message, type) {
        this.fdObject.interface.trigger("showNotify", {
          type: type,
          title: message.status || "",
          message: message.message,
        });
      },

      // debounce(fn, delay = 300) {  // unused: mounted() that used this is commented out
      //   let timeout;
      //   return function (...args) {
      //     clearTimeout(timeout);
      //     timeout = setTimeout(() => {
      //       fn.apply(this, args);
      //     }, delay);
      //   };
      // },
      async loadMore(index, value) {
        try {
          this.$set(this.isLoadingMore, index, true);
          const { response } = await this.fdObject.request.invoke(
            "serverMethod",
            {
              type: "loadMoreTickets",
              loggedInUser: this.loggedInUser,
              ticketFieldName: this.ticketFieldName,
              defaultFilter: this.defaultFilter,
              ticketFields: this.ticketFields,
              value: value,
              pages: this.pages,
              index,
            },
          );

          const { tickets, error } = response.response;

          if (!error) {
            const current = Array.isArray(this.tickets[index])
              ? this.tickets[index]
              : [];
            this.$set(this.tickets, index, [...current, ...tickets.results]);
            if (this.tickets[index].length < tickets.total) {
              this.hasMore[index] = true;
              this.pages[index]++;
            } else if (this.tickets[index].length === tickets.total)
              this.hasMore[index] = false;
          }
        } catch (error) {
          console.error(error);
        } finally {
          this.$set(this.isLoadingMore, index, false);
        }
      },
      loadMoreWrapper() {
        // Find the element that triggered the scroll
        const el = this.$el.querySelector(".tickets-scroll:hover");

        if (!el) return;

        const index = Number(el.dataset.index);
        const value = el.dataset.value;

        this.loadMore(index, value);
      },

      async changeTicketFieldStatus(id, status) {
        let body = {};
        if (this.ticketFieldName.startsWith("cf_")) {
          body["custom_fields"] = {};
          body["custom_fields"][this.ticketFieldName] = status;
        } else {
          body[this.ticketFieldName] = status;
        }

        try {
          const { response } = await this.fdObject.request.invoke(
            "serverMethod",
            {
              type: "updateTicket",
              ticketId: id,
              loggedInUser: this.loggedInUser,
              body,
            },
          );
          const { error } = response.response;
          if (!error) {
            this.showNotify(
              {
                message: "Status updated",
              },
              "success",
            );
          } else {
            this.showNotify({ message: "Failed to update ticket" }, "danger");
          }
        } catch (error) {
          console.error(error);
          this.showNotify({ message: error.response }, "danger");
        }
      },
      getOptions(name) {
        if (name === "agent") {
          return this.agentsList.map((agent) => ({
            label: agent.contact.name,
            value: agent.id,
          }));
        }

        const fieldObj = this.dropdownFields.find((x) => x.name === name);

        if (!fieldObj?.choices) return [];

        const choices = fieldObj.choices;

        // Convert object or array to dropdown format
        return Array.isArray(choices)
          ? choices.map((c) => ({ label: c, value: c }))
          : Object.keys(choices).map((key) => ({
              label: choices[key][0] || key,
              value: Array.isArray(choices[key]) ? Number(key) : choices[key],
            }));
      },

      _handleRefresh() {
        //  this.currentPage = 1;
        this.showAllLoading();
        this.getAllTickets();
      },

      async _handleRemoveFilters() {
        this.filters = {};
        const defaultFields = this.dbData.filter?.defaultFields || [];
        this.filters.defaultFields = defaultFields;
        this.dbData = {
          ...this.dbData,
          filter: this.filters,
        };
        await this.setData();
        this.buildFilters();
      },
      _handleRemoveGroupBy() {
        this.dbData.group = null;
        this.groupBy = null;
        this.setData();
        this.getTicketFieldsOptions();
      },
      _getState(key) {
        return `Drag and Drop here to ${key} state`;
      },

      handleOnlyMyTickets() {
        this.onlyMyIssues = true;
        this.buildFilters();
      },

      handleAllTickets() {
        this.onlyMyIssues = false;
        this.buildFilters();
      },

      handleRecentlyUpdated() {
        this.recentlyUpdated = !this.recentlyUpdated;
        this.buildFilters();
      },

      _filterSelectedAgents() {
        try {
          this.buildFilters();
        } catch (error) {
          console.error(error);
        }
      },

      // _filterSelectedGroups() {  // unused: template uses _filterSelectedAgents for all filter dropdowns
      //   this.buildFilters();
      // },

      // _filterSelectedPriority() {  // unused: same as above, never called from template
      //   this.buildFilters();
      // },

      async _handleGroupBy(value) {
        try {
          const [name, fieldIdStr] = value.split(",");
          const fieldId = Number(fieldIdStr);
          // Find existing field & move it to top
          const existingIndex =
            this.dbData.field_data?.findIndex(
              (item) => item.selectedTicketField === name,
            ) ?? -1;
          let existsObj = null;
          if (existingIndex !== -1) {
            [existsObj] = this.dbData.field_data.splice(existingIndex, 1);
            this.dbData.field_data.unshift(existsObj);
          }

          // If field already exists
          if (existsObj) {
            this.ticketFields = [
              ...existsObj.selectedChoice.map((elm) => ({
                ...elm,
                showInBoard: true,
              })),
              ...existsObj.hiddenChoice.map((elm) => ({
                ...elm,
                showInBoard: false,
              })),
            ];

            this.ticketFieldName = name;
            this.dbData.group = name;

            this.showAllLoading();
            await this.setData();
            await this.getAllTickets();
            return;
          }

          // New field selection
          const fieldObj = this.dropdownFields.find(
            (field) => field.name === name,
          );
          if (!fieldObj?.choices) return [];

          const { choices } = fieldObj;

          this.ticketFieldName =
            fieldObj.name === "group" ? "group_id" : fieldObj.name;

          // Convert object or array to dropdown format
          const formatted = Array.isArray(choices)
            ? choices.map((choice) => ({
                key: choice,
                value: choice,
                showInBoard: true,
              }))
            : Object.keys(choices).map((key) => ({
                key: choices[key][0] || key,
                value: Array.isArray(choices[key]) ? key : choices[key],
                showInBoard: true,
              }));

          this.ticketFields = [...formatted];

          if (!this.dbData.field_data) this.dbData.field_data = [];
          this.dbData.field_data.unshift({
            selectedTicketField: name,
            selectedChoiceId: fieldId,
            selectedChoice: formatted,
            hiddenChoice: [],
          });

          this.dbData.group = name;

          this.showAllLoading();
          await this.setData();
          await this.getAllTickets();
        } catch (error) {
          console.error(error);
        }
      },

      getList() {
        return this.dropdownFields
          .filter(
            (x) =>
              x.type !== "default_agent" &&
              x.choices &&
              (Array.isArray(x.choices)
                ? x.choices.length
                : Object.keys(x.choices).length) <= 25,
          )
          .map((x) => ({
            label: x.label,
            value: `${x.name},${x.id}`,
          }));
      },
      // getNumberList() {  // unused: never called from template or any other method
      //   let list = [
      //     { value: "due_by", label: "Due By" },
      //     { value: "created_at", label: "Created At" },
      //     { value: "updated_at", label: "Updated At" },
      //     { value: "due_by", label: "Due Date" },
      //   ];

      //   list = [
      //     ...list,
      //     ...this.allTicketFields
      //       .filter(
      //         (x) =>
      //           x.type === "custom_date" ||
      //           x.type === "custom_number" ||
      //           x.type === "custom_decimal",
      //       )
      //       .map((x) => ({ value: x.name, label: x.label })),
      //   ];
      //   return list;
      // },

      async setData() {
        try {
          await this.fdObject.db.set(`ticket-fields-${this.loggedInUser}`, {
            field_data: this.dbData.field_data,
            group: this.dbData.group,
            filter: this.filters,
          });
        } catch (error) {
          console.error(error);
        }
      },
      // storeInsessionStorage() {  // unused: never called anywhere in the app
      //   try {
      //     sessionStorage.setItem("tickets", JSON.stringify(this.tickets));
      //   } catch (error) {
      //     console.error(error);
      //   }
      // },
      // getSessionStorage() {  // unused: replaced by ticketBak as the local cache
      //   try {
      //     const tickets = sessionStorage.getItem("tickets");
      //     if (tickets) return JSON.parse(tickets);
      //   } catch (error) {
      //     console.error(error);
      //   }
      // },
      buildFilters() {
        const queryParams = this.constructQueryParams();
        this.showAllLoading();
        this.dbData.filter = this.filters;
        this.setData();
        if (queryParams.length > 0) {
          this.hasFilter = true;
          // this.currentPage = 1;
          this.defaultFilter = queryParams.join(" AND ");
          this.getAllTickets();
        } else {
          this.hasFilter = false;
          // this.currentPage = 1;
          this.defaultFilter = "";
          this.getAllTickets();
        }
      },

      async filterBySessionData(tickets, isTrue) {
        try {
          this.showAllLoading();
          const updatedTickets = [];
          const filterEntries = Object.entries(this.filters)
            .filter(
              ([key, values]) => key !== "defaultFields" && values.length > 0,
            )
            .map(([key, values]) => [key, new Set(values)]);
          tickets.forEach((ticketColumn) => {
            const filteredTickets = ticketColumn.filter((ticket) => {
              for (const [key, valueSet] of filterEntries) {
                if (
                  !valueSet.has(
                    ticket[
                      key === "agent"
                        ? "responder_id"
                        : key === "group"
                          ? "group_id"
                          : key
                    ],
                  )
                )
                  return false;
              }
              return true;
            });
            updatedTickets.push(filteredTickets);
          });

          const queryParams = this.constructQueryParams();
          this.dbData.filter = this.filters;
          if (!isTrue) await this.setData();
          this.tickets = updatedTickets;
          if (queryParams.length > 0) {
            this.hasFilter = true;
            this.defaultFilter = queryParams.join(" AND ");
          } else {
            this.hasFilter = false;
            this.defaultFilter = "";
          }
          this.closeAllLoading();
        } catch (error) {
          console.error(error);
        }
      },
      constructQueryParams() {
        let queryParams = [];

        // Special handling for agent_id and group_id (OR relationship between them)
        let agentParams = [];
        let groupParams = [];

        if (this.filters.agent && this.filters.agent.length > 0) {
          this.filters.agent.forEach((element) => {
            agentParams.push(`agent_id:${element}`);
          });
        }

        if (this.filters.group && this.filters.group.length > 0) {
          this.filters.group.forEach((element) => {
            groupParams.push(`group_id:${element}`);
          });
        }

        // Combine agent and group with OR between them
        if (agentParams.length > 0 && groupParams.length > 0) {
          queryParams.push(
            `(${agentParams.join(" OR ")}) OR (${groupParams.join(" OR ")})`,
          );
        } else {
          if (agentParams.length > 0) {
            queryParams.push(`(${agentParams.join(" OR ")})`);
          }
          if (groupParams.length > 0) {
            queryParams.push(`(${groupParams.join(" OR ")})`);
          }
        }
        // Handle all other dynamic fields
        this.dropdownFields.forEach((field) => {
          // Skip agent_id and group_id as they're already handled above
          if (field.name === "agent" || field.name === "group") {
            return;
          }

          const filterValue = this.filters[field.name];

          if (filterValue !== undefined && filterValue !== null) {
            // Handle multiple select fields
            if (Array.isArray(filterValue) && filterValue.length > 0) {
              let fieldParams = filterValue.map(
                (val) =>
                  `${field.name === "ticket_type" ? "type" : field.name}:${val}`,
              );
              queryParams.push(`(${fieldParams.join(" OR ")})`);
            }
            // Handle single select fields
            else if (!Array.isArray(filterValue) && filterValue !== "") {
              queryParams.push(`${field.name}:${filterValue}`);
            }
          }
        });

        if (this.onlyMyIssues) {
          queryParams.push(`agent_id:${this.loggedInUser}`);
        }

        if (this.recentlyUpdated) {
          let date = new Date();
          queryParams.push(`updated_at:'${this.formatDate(date)}'`);
        }
        return queryParams;
      },
      async handleRemove(name) {
        try {
          if (this.filters.defaultFields.length === 1)
            this.showNotify(
              {
                message: "You must have at least one filter",
                title: "Field exceeded",
              },
              "info",
            );
          else
            this.filters.defaultFields = this.filters.defaultFields.filter(
              (x) => x.name !== name,
            );
          delete this.filters[name];
          this.dbData = {
            ...this.dbData,
            filter: this.filters,
          };
          await this.setData();
          this.buildFilters();
          if (this.filters.defaultFields.length < 3)
            this.canAddMoreFields = true;
        } catch (error) {
          console.error(error);
        }
      },

      getAdditionalFields() {
        const names = new Set(this.filters.defaultFields?.map((f) => f.name));
        return this.dropdownFields.filter((f) => !names.has(f.name));
      },
      async addFilterField(field) {
        try {
          // this.showNotify(
          //   {
          //     message:
          //       "You can select only three filters. Please remove one to add another",
          //     title: "Field exceeded",
          //   },
          //   "info"
          // );
          // else {
          this.filters.defaultFields.push({
            name: field.name,
            label: field.label,
          });
          await this.setData();
          if (this.filters.defaultFields.length === 3)
            this.canAddMoreFields = false;
          // }
          this.showMoreFilters = false;
        } catch (error) {
          console.error(error);
        }
      },
    },
  });
})();
