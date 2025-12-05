(function () {
  new Vue({
    el: "#kabanaId",
    components: {
      TicketCard,
    },
    data: {
      currentPage: 1,
      disablePagination: false,
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
      initFD() {
        return app
          .initialized()
          .then((client) => {
            this.fdObject = client;
            this.fdObject.data
              .get("loggedInUser")
              .then((data) => {
                this.$refs.kanbanContainder.classList.remove("hide");
                this.loggedInUser = data.loggedInUser.id;
                this.getIparams();
                if (!this.hasAccess) return;
                this.getAgentList();
                this.getDataFromModel();
                this.getTicketFields();
              })
              .catch((error) => {
                console.log(error);
                this.showNotify({ message: error.response }, "danger");
              });
          })
          .catch((error) => {
            console.log(error);
            this.showNotify({ message: error.response }, "danger");
          });
      },

      getIparams() {
        this.fdObject.iparams
          .get()
          .then((data) => {
            console.log(data);
            this.iparams = data;
            this.isApiAccessEnabled = data.enable_api_key_access;
            if (this.isApiAccessEnabled)
              this.hasAccess = data.agent_ids.includes(this.loggedInUser);
            else this.hasAccess = true;
          })
          .catch((error) => {
            console.error(error);
          });
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

      // TODO: we need to store the filters and get the filters and show it here.
      // getTicketFieldsOptions() {
      //   this.getSelectedTicketFields()
      //     .then((data) => {
      //       let fieldObj = {};
      //       if (!data.field_data) {
      //         this.dbData.field_data = [data];
      //       } else this.dbData = { ...data };

      //       if (this.dbData.group) {
      //         fieldObj = this.dbData.field_data.find(
      //           (x) => x.selectedTicketField === this.dbData.group
      //         );
      //         this.groupBy = `${this.dbData.group},${fieldObj.selectedChoiceId}`;
      //       } else fieldObj = this.dbData.field_data[0];
      //       this.ticketFieldName = fieldObj.selectedTicketField;
      //       console.log(this.dbData);

      //       // this wil throw to catch block if source/product seleted already in previous versions (for backward compatabality)
      //       if (
      //         this.ticketFieldName === "source" ||
      //         this.ticketFieldName === "product_id"
      //       ) {
      //         throw { status: 404 };
      //       }

      //       let selectedChoice = fieldObj.selectedChoice.map((elm) => {
      //         elm.showInBoard = true;
      //         return elm;
      //       });

      //       let dataHidden = fieldObj.hiddenChoice || [];
      //       let hiddenChoice = dataHidden.map((elm) => {
      //         elm.showInBoard = false;
      //         return elm;
      //       });

      //       this.ticketFields = [...selectedChoice, ...hiddenChoice];
      //       let isFilter = false;
      //       for (let key in this.dbData.filter) {
      //         if (
      //           key !== "defaultFields" &&
      //           this.dbData.filter[key].length > 0
      //         ) {
      //           isFilter = true;
      //           break;
      //         }
      //       }

      //       if (this.hasFilter) {
      //         this.handleOnlyMyTickets();
      //       } else if (isFilter) {
      //         this.filters = { ...this.dbData.filter };
      //         this.buildFilters();
      //       } else {
      //         this.showAllLoading();
      //         this.getAllTickets();
      //       }
      //     })
      //     .catch((err) => {
      //       console.error(err);
      //       if (err.status === 404) {
      //         this.fdObject.request
      //           .invokeTemplate("getStatusList", {
      //             context: { agentId: this.loggedInUser },
      //           })
      //           .then((data) => {
      //             if (data.status == 200) {
      //               let choice = JSON.parse(data.response)[0].choices;
      //               let keyValue = [];
      //               for (let key in choice) {
      //                 keyValue.push({
      //                   key: choice[key][0],
      //                   value: key.toString(),
      //                   showInBoard: true,
      //                 });
      //               }
      //               this.ticketFieldName = "status";
      //               this.ticketFields = keyValue;
      //               if (this.hasFilter) {
      //                 this.handleOnlyMyTickets();
      //               } else {
      //                 this.showAllLoading();
      //                 this.getAllTickets();
      //               }
      //             } else {
      //               throw data;
      //             }
      //           })
      //           .catch((error) => {
      //             console.log(error);
      //             if (error.status == 400 || error.status == 404) {
      //               this.showNotify(
      //                 { message: "Invalid API Key / Domain Name" },
      //                 "danger"
      //               );
      //             } else {
      //               this.showNotify({ message: error.response }, "danger");
      //             }
      //           });
      //       }
      //     });
      // },
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
            (key) => key !== "defaultFields" && filter[key]?.length > 0
          );

          if (this.hasFilter) {
            this.handleOnlyMyTickets();
          } else if (hasAnyFilter) {
            this.filters = { ...filter };
            this.buildFilters();
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
                }
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
                "danger"
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
      async getAllTickets() {
        this.searchInput = "";
        this.tickets = [];
        for (const [index, element] of this.ticketFields.entries()) {
          if (element.showInBoard) {
            this.pages[index] = 1;
            const { tickets, error } = await this.fetchTickets(
              element.value,
              index
            );
            if (!error) {
              this.tickets.push(
                this.getTickets(tickets.results, element.value)
              );
              if (this.tickets[index].length < tickets.total) {
                this.hasMore[index] = true;
                this.pages[index]++;
              } else if (this.tickets[index]?.length === tickets.total)
                this.hasMore[index] = false;
              // this.disableScroll[index] = true;

              this.ticketBak = this.tickets;
            }
            this.closeLoading(element.key);
          }
          this.disablePagination = false;
        }
      },

      async fetchTickets(value, index) {
        try {
          const pageOptions = `&page=${this.pages[index]}`;
          const renamedField =
            this.ticketFieldName === "responder_id"
              ? "agent_id"
              : this.ticketFieldName;
          const defaultFilter =
            this.defaultFilter !== "" ? ` AND ${this.defaultFilter}` : "";
          // Filter for custom field ad type will be string, so checking and adding the same
          const isString =
            this.ticketFieldName.startsWith("cf_") ||
            this.ticketFieldName === "type";
          const filter = encodeURI(
            `query="${renamedField}:${
              value !== "Unassigned" ? (isString ? `'${value}'` : value) : null
            }${defaultFilter}"`
          );
          // const context = { filter: filter + pageOptions };
          // if (this.isApiAccessEnabled)
          //   context.params = "<%= encode(iparam.api_key) %>";
          // else {
          //   context.params =
          //     "<%= encode(iparam.credentials[context.agentId]) %>";
          //   context.agentId = this.loggedInUser;
          // }
          const { response, status, headers } =
            await this.fdObject.request.invokeTemplate("getAllTickets", {
              context: {
                filter: filter + pageOptions,
                agentId: this.loggedInUser,
              },
            });
          if (status === 200) {
            const tickets = JSON.parse(response);
            return {
              tickets,
              headers,
              error: false,
            };
          }
        } catch (error) {
          console.error(error);
          if (error.status == 400 || error.status == 404) {
            this.showNotify(
              { message: "Invalid API Key / Domain Name" },
              "danger"
            );
          } else if (error.status == 429) {
            this.showNotify(
              { message: "Too many requests. Please try again later." },
              "danger"
            );
          } else {
            this.showNotify({ message: error.response }, "danger");
          }
          return {
            error: true,
          };
        }
      },
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
              fieldTypes.includes(x.type)
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

      getTickets(tickets, value) {
        const ticketData = tickets.filter((element) => {
          let ticket = this.ticketFieldName.startsWith("cf_")
            ? element.custom_fields
            : element;
          if (value === "Unassigned") {
            return ticket[this.ticketFieldName] === null;
          } else {
            return ticket[this.ticketFieldName] === Number(value)
              ? Number(value)
              : value;
          }
        });
        return ticketData;
      },
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
            //  console.log(this.agentsList);

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
          console.log(error);
          if (error.status === 400 || error.status === 404) {
            this.showNotify(
              { message: "Invalid API Key / Domain Name" },
              "danger"
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
            console.log(error);
            if (error.status == 400 || error.status == 404) {
              this.showNotify(
                { message: "Invalid API Key / Domain Name" },
                "danger"
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
            console.log(error);
            if (error.status == 400 || error.status == 404) {
              this.showNotify(
                { message: "Invalid API Key / Domain Name" },
                "danger"
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
      debounce(fn, delay = 300) {
        let timeout;
        return function (...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            fn.apply(this, args);
          }, delay);
        };
      },
      async loadMore(index, value) {
        try {
          console.log("Loading more for column:", index, value);
          this.isLoadingMore[index] = true;
          const { tickets, error } = await this.fetchTickets(value, index);
          console.log(tickets);
          if (!error) {
            const current = Array.isArray(this.tickets[index])
              ? this.tickets[index]
              : [];
            this.$set(this.tickets, index, [...current, ...tickets.results]);
            if (this.tickets[index].length < tickets.total) {
              this.hasMore = true;
              this.pages[index]++;
            } else if (this.tickets[index].length === tickets.total)
              this.hasMore[index] = false;
          }
        } catch (error) {
          console.error(error);
        } finally {
          this.isLoadingMore[index] = false;
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

      changeTicketFieldStatus(id, status) {
        // const url = "<%= iparam.$domain.url %>/api/channel/v2/tickets/" + id;
        // const headers = {
        //   Authorization: "Basic <%= encode(iparam.api_key) %>",
        //   "content-type": "application/json",
        // };
        let body = {};
        if (this.ticketFieldName.startsWith("cf_")) {
          body["custom_fields"] = {};
          body["custom_fields"][this.ticketFieldName] = status;
        } else {
          body[this.ticketFieldName] = status;
        }
        // const options = {
        //   headers: headers,
        //   body: JSON.stringify(body),
        // };

        this.fdObject.request
          .invokeTemplate("updateTicket", {
            context: { ticketId: id, agentId: this.loggedInUser },
            body: JSON.stringify(body),
          })
          .then((data) => {
            if (data.status == 200) {
              this.showNotify(
                {
                  message: "Status updated",
                },
                "success"
              );
            } else {
              throw data;
            }
          })
          .catch((error) => {
            console.log(error);
            this.showNotify({ message: error.response }, "danger");
          });
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

      _handlepreviousPage() {
        if (this.currentPage > 1) {
          this.currentPage--;
        }
        this.disablePagination = true;
        this.showAllLoading();
        this.getAllTickets();
      },

      _handleNextPage() {
        if (this.currentPage >= 1) {
          this.currentPage++;
        }
        this.disablePagination = true;
        this.showAllLoading();
        this.getAllTickets();
      },

      _handleRefresh() {
        this.currentPage = 1;
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

        // this.selectedAgents = [];
        // this.selectedGroups = [];
        // this.selectedPriority = null;
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
        this.buildFilters();
      },

      _filterSelectedGroups() {
        this.buildFilters();
      },

      _filterSelectedPriority() {
        this.buildFilters();
      },
      _handleSortBy() {
        console.log("Hello");
      },
      async _handleGroupBy(name) {
        const fieldId = Number(name.split(",")[1]);
        name = name.split(",")[0];

        try {
          const existsObj = this.dbData.field_data.find(
            (x) => x.selectedTicketField === name
          );

          if (existsObj) {
            this.ticketFields = [
              ...existsObj.selectedChoice.map((elm) => {
                elm.showInBoard = true;
                return elm;
              }),
              ...existsObj.hiddenChoice.map((elm) => {
                elm.showInBoard = false;
                return elm;
              }),
            ];
            this.ticketFieldName = name;
            this.dbData.group = name;
            await this.setData();
            await this.getAllTickets();
            return;
          }
          const fieldObj = this.dropdownFields.find((x) => x.name === name);
          if (!fieldObj?.choices) return [];
          const choices = fieldObj.choices;
          this.ticketFieldName =
            fieldObj.name === "group" ? "group_id" : fieldObj.name;
          // Convert object or array to dropdown format
          const formatted = Array.isArray(choices)
            ? choices.map((c) => ({ key: c, showInBoard: true, value: c }))
            : Object.keys(choices).map((key) => ({
                key: choices[key][0] || key,
                showInBoard: true,
                value: Array.isArray(choices[key]) ? key : choices[key],
              }));
          this.ticketFields = [...formatted];
          this.dbData.field_data = [
            ...this.dbData.field_data,
            {
              selectedTicketField: name,
              selectedChoiceId: fieldId,
              selectedChoice: formatted,
              hiddenChoice: [],
            },
          ];
          this.dbData.group = name;
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
                : Object.keys(x.choices).length) <= 25
          )
          .map((x) => ({
            label: x.label,
            value: `${x.name},${x.id}`,
          }));
      },
      getNumberList() {
        let list = [
          { value: "due_by", label: "Due By" },
          { value: "created_at", label: "Created At" },
          { value: "updated_at", label: "Updated At" },
          { value: "due_by", label: "Due Date" },
        ];

        list = [
          ...list,
          ...this.allTicketFields
            .filter(
              (x) =>
                x.type === "custom_date" ||
                x.type === "custom_number" ||
                x.type === "custom_decimal"
            )
            .map((x) => ({ value: x.name, label: x.label })),
        ];
        return list;
      },
      _handleSortByOrder() {
        console.log("yes");
      },
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
      buildFilters() {
        let queryParams = [];

        // Handle special case for "Only My Issues" if it still exists
        if (this.onlyMyIssues && this.filters.agent_id) {
          if (!this.filters.agent_id.includes(this.loggedInUser)) {
            this.filters.agent_id.push(this.loggedInUser);
          }
        }

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
            `(${agentParams.join(" OR ")}) OR (${groupParams.join(" OR ")})`
          );
        } else {
          if (agentParams.length > 0) {
            queryParams.push(`(${agentParams.join(" OR ")})`);
          }
          if (groupParams.length > 0) {
            queryParams.push(`(${groupParams.join(" OR ")})`);
          }
        }
        console.log(this.filters);
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
                  `${field.name === "ticket_type" ? "type" : field.name}:${val}`
              );
              queryParams.push(`(${fieldParams.join(" OR ")})`);
            }
            // Handle single select fields
            else if (!Array.isArray(filterValue) && filterValue !== "") {
              queryParams.push(`${field.name}:${filterValue}`);
            }
          }
        });

        // Handle recently updated if it still exists
        if (this.recentlyUpdated) {
          let date = new Date();
          queryParams.push(`updated_at:'${this.formatDate(date)}'`);
        }

        this.showAllLoading();

        if (queryParams.length > 0) {
          this.dbData.filter = this.filters;
          this.hasFilter = true;
          this.currentPage = 1;
          this.defaultFilter = queryParams.join(" AND ");
          this.getAllTickets();
          this.setData();
        } else {
          this.hasFilter = false;
          this.currentPage = 1;
          this.defaultFilter = "";
          this.getAllTickets();
        }
      },
      async handleRemove(name) {
        try {
          if (this.filters.defaultFields.length === 1)
            this.showNotify(
              {
                message: "You must have at least one filter",
                title: "Field exceeded",
              },
              "info"
            );
          else
            this.filters.defaultFields = this.filters.defaultFields.filter(
              (x) => x.name !== name
            );
          delete this.filters[name];
          this.dbData = {
            ...this.dbData,
            filter: this.filters,
          };
          await this.setData();
          this.buildFilters();
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
          if (this.filters.defaultFields.length === 3)
            this.showNotify(
              {
                message:
                  "You can select only three filters. Please remove one to add another",
                title: "Field exceeded",
              },
              "info"
            );
          else {
            this.filters.defaultFields.push({
              name: field.name,
              label: field.label,
            });
            await this.setData();
          }
        } catch (error) {
          console.error(error);
        }
      },
    },
  });
})();
