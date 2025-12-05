let TicketCard = Vue.component("TicketCard", {
  template: `
    <div :id="currentStatusNumber" @click="_handleClick">
      <el-card :class="['box-card', priorityClass, animateClass]" shadow="hover" :body-style="{ padding: '10px' }" class="animate">
        <div class="ticket-id">
          <span>#{{ticketId}}</span> <span class="card-due-By" :style="dueByFormatted">{{dueByFormatted?.text}}</span>
          <el-popover
            placement="bottom"
            width="250"
            v-model="popupVisible">
              <span class="pull-right card-menu" style="padding: 5px 10px" slot="reference"
                @click.stop="_handleMenuClick" title="Quick Actions">
                <i class="fa fa-ellipsis-v" aria-hidden="true"></i>
                </span>
              <div class="assign-container">
                <div class="assign-header">QUICK ACTIONS</div>
                <button class="btn btn-primary" @click="_handleAssignToMe" :disabled="loggedInUser==agentId">Assign to Me</button>
              </div>
              <div class="quick-actions-container">
                <div class="assign-header no-margin">PRIORITY</div>
                  <div class="form-group">
                    <el-select id="priorityId" class="width-100" v-model="selectedPriority" filterable placeholder="Priority" no-match-text="No Items" no-data-text="No Options" @change="_changePriority()">
                      <el-option v-for="item in priorityList" :key="item.id" :label="item.name" :value="item.id">
                        <span class="priority" :style="{'background-color':item.color }"></span>
                        <span>{{ item.name }}</span>
                      </el-option>
                    </el-select>
                  </div>

                  <div class="assign-header no-margin">GROUP</div>
                  <div class="form-group">
                    <el-select id="groupId" class="width-100" v-model="selectedGroup" filterable placeholder="Group" no-match-text="No Items" no-data-text="No Options" @change="_changeGroup()">
                      <el-option v-for="item in groupsList" :key="item.id" :label="item.name" :value="item.id">
                        <span>{{ item.name }}</span>
                      </el-option>
                    </el-select>
                  </div>
              </div>
            </el-popover>
        </div>
        <div class="card-subject" :title="subject">
          {{subject}}
        </div>
        <div class="card-description">{{description}} </div>
        <div class="status-container">
          <span class="due-by">Due: <b>{{ dueBy | date}}</b> </span>
          <div class="author-container" v-if="agentNameFormatted">
          Assigned To
           <div class="author" :title="agentName">
              {{agentNameFormatted}}
            </div>
          </div>
        </div>
      </el-card>
    </div>
`,

  props: {
    fdObject: Object,
    subject: String,
    agentNameProp: String,
    statusProp: Number,
    ticketId: Number,
    priority: Number,
    dueBy: String,
    frDueBy: String,
    sourceProp: Number,
    loggedInUser: Number,
    currentStatusNumber: String,
    ticketField: String,
    description: String,
    agentIdProp: Number,
    groupsList: Array,
    group: Number,
  },
  data() {
    return {
      agentName: this.agentNameProp,
      status: this.statusProp,
      source: this.sourceProp,
      agentId: this.agentIdProp,
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
      popupVisible: false,
      selectedPriority: this.priority,
      animateClass: "",
      selectedGroup: this.group,
    };
  },

  computed: {
    dueByFormatted() {
      if (Number(this.status) !== 4 && Number(this.status) !== 5) {
        let dueby = moment(this.dueBy);
        let diff = dueby.diff(moment(), "hours");

        // @todo: will disable this for now due to lack of API support
        // let frDueBy = moment(this.frDueBy);
        // let diffFr = frDueBy.diff(moment(), 'hours');
        // if (diff > 0 && diffFr > 0) {
        //   return {
        //     text: 'First Response due',
        //     color: "#0062E8",
        //     background: "#EAF3FF",
        //     border: "1pt solid #5EA2FF"
        //   };
        // } else
        if (diff <= 0) {
          return {
            text: "Overdue",
            color: "#c82124",
            background: "#ffecf0",
            border: "1pt solid #ffd0d6",
          };
        }
      } else {
        return null;
      }
    },

    agentNameFormatted() {
      if (this.agentName !== "N/A") {
        let agent = this.agentName.split(" ");
        let firstLetter = "",
          lastLetter = "";
        agent.forEach((element, index) => {
          if (index === 0) {
            firstLetter = element.charAt(0);
          } else if (index === agent.length - 1) {
            lastLetter = element.charAt(0);
          }
        });
        return firstLetter + lastLetter;
      } else {
        return "";
      }
    },

    priorityClass() {
      let className = "";
      switch (Number(this.selectedPriority)) {
        case 1:
          className = "low-ticket";
          break;

        case 2:
          className = "medium-ticket";
          break;

        case 3:
          className = "high-ticket";
          break;

        case 4:
          className = "urgent-ticket";
          break;

        default:
          className = "low-ticket";
          break;
      }
      return className;
    },
  },
  filters: {
    date: function (str) {
      if (!str) {
        return "N/A";
      }
      return moment(str).format("lll");
    },
  },

  mounted() {
    let date = new Date(this.dueBy);
    let currentDate = new Date();

    switch (this.ticketField) {
      case "status":
        if (
          date <= currentDate &&
          (this.currentStatusNumber == 2 || this.currentStatusNumber == 3)
        ) {
          let priority = ["low", "medium", "high", "urgent"];
          this.animateClass = "animate-" + priority[this.priority - 1];
          setTimeout(() => {
            this.animateClass = "";
          }, 50000);
        }
        this.status = Number(this.currentStatusNumber);
        break;
      case "priority":
        this.selectedPriority = Number(this.currentStatusNumber);
        break;
      case "source":
        this.source = this.currentStatusNumber;
        break;
      case "group_id":
        let statusNumber = Number(this.currentStatusNumber);
        this.selectedGroup = Number.isNaN(statusNumber)
          ? "Un Assigned"
          : statusNumber;
      case "responder_id":
        this.agentId = Number(this.currentStatusNumber);
        this.getAgentName();
    }
  },

  updated() {
    if (this.ticketField === "status") {
      this.status = Number(this.currentStatusNumber);
    } else if (this.ticketField === "priority") {
      this.selectedPriority = Number(this.currentStatusNumber);
    } else if (this.ticketField === "source") {
      this.source = this.currentStatusNumber;
    } else if (this.ticketField === "group_id") {
      let statusNumber = Number(this.currentStatusNumber);
      this.selectedGroup = Number.isNaN(statusNumber)
        ? "Un Assigned"
        : statusNumber;
    } else if (this.ticketField === "responder_id") {
      this.agentId = Number(this.currentStatusNumber);
      this.getAgentName();
    }
  },

  methods: {
    _handleMenuClick() {
      this.popupVisible = !this.popupVisible;
    },

    _handleAssignToMe() {
      this.setQuickActions(true);
    },

    _changePriority() {
      this.setQuickActions();
    },

    _changeGroup() {
      this.setQuickActions();
    },

    _handleClick() {
      this.$emit(
        "ticket-click",
        this.ticketId,
        this.subject,
        this.agentName,
        this.status
      );
    },
    async getAgentName() {
      if (this.agentId !== "" && this.agentId) {
        console.log(this.agentId);
        try {
          const { response, status } =
            await this.fdObject.request.invokeTemplate("getAgent", {
              context: {
                agentId: this.agentId,
              },
            });
          if (status == 200) {
            this.agentName = JSON.parse(response).contact.name;
          } else {
            throw response;
          }
        } catch (error) {
          console.error(error);
          this.showNotify("error occured", "danger");
        }
        // this.fdObject.request
        //   .invokeTemplate("getAgent", {
        //     context: {
        //       agentId: this.agentId,
        //     },
        //   })
        //   .then((data) => {
        //     if (data.status == 200) {
        //       this.agentName = JSON.parse(data.response).contact.name;
        //     } else {
        //       throw data;
        //     }
        //   })
        //   .catch((error) => {
        //     console.error(error);
        //     this.showNotify("error occured", "danger");
        //   });
      } else {
        this.agentName = "N/A";
      }
    },

    setQuickActions(isAssignedTOMe) {
      this.popupVisible = false;
      // const url =
      //   "<%= iparam.$domain.url %>/api/channel/v2/tickets/" + this.ticketId;
      // const headers = {
      //   Authorization: "Basic <%= encode(iparam.api_key) %>",
      //   "Content-Type": "application/json",
      // };
      // const options = {
      //   headers,
      const body = {
        status: Number(this.status),
        priority: Number(this.selectedPriority),
        source: Number(this.source),
      };
      // };
      if (this.selectedGroup) {
        body.group_id = Number.isNaN(this.selectedGroup)
          ? null
          : this.selectedGroup;
      }
      if (isAssignedTOMe) {
        body.responder_id = this.loggedInUser;
      }

      this.fdObject.request
        .invokeTemplate("updateTicket", {
          body: JSON.stringify(body),
          context: { ticketId: this.ticketId },
        })
        .then((data) => {
          if (data.status == 200) {
            this.agentId = JSON.parse(data.response).responder_id;
            this.selectedPriority = JSON.parse(data.response).priority;
            this.getAgentName();
            this.showNotify(
              { message: "Status updated successfully" },
              "success"
            );
          } else {
            throw data;
          }
        })
        .catch((error) => {
          console.error(error);
          this.showNotify(JSON.parse(error.response).errors[0], "danger");
        });
    },

    showNotify(message, type) {
      this.fdObject.interface.trigger("showNotify", {
        type: type,
        title: message.status || "",
        message: message.message,
      });
    },
  },
});
